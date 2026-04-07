namespace gdjs {
  interface RuntimeInstanceContainer {
    navMesh3DManager?: NavMesh3DManager;
  }

  type RuntimeObjectWith3DRenderer = gdjs.RuntimeObject & {
    get3DRendererObject?: () => THREE.Object3D | null;
    getZ?: () => number;
    setZ?: (z: number) => void;
  };

  type RuntimeLayerRendererWith3D = {
    add3DRendererObject?: (object: THREE.Object3D) => void;
    remove3DRendererObject?: (object: THREE.Object3D) => void;
  };

  type RuntimeLayerRendererWithRequired3D = {
    add3DRendererObject: (object: THREE.Object3D) => void;
    remove3DRendererObject: (object: THREE.Object3D) => void;
  };

  type NavTriangle = {
    id: number;
    a: THREE.Vector3;
    b: THREE.Vector3;
    c: THREE.Vector3;
    centroid: THREE.Vector3;
    neighbors: number[];
    cost: number;
  };

  type LayerNavData = { triangles: NavTriangle[] };

  type ClosestTriangleMatch = {
    index: number;
    point: THREE.Vector3;
  };

  type ResolvedLinkEdge = {
    to: number;
    startPoint: THREE.Vector3;
    endPoint: THREE.Vector3;
    costMultiplier: number;
  };

  type AStarRoute = {
    triangles: number[];
    viaByNode: Map<number, ResolvedLinkEdge>;
  };

  const navMeshTriangleAreaEpsilon = 1e-4;
  const navMeshPointEpsilonSq = 0.0001;

  const navMeshSurfaceDefaultMaxSlope = 60;
  const navMeshSurfaceDefaultAreaCost = 1;
  const navMeshSurfaceDefaultRefreshFrames = 20;

  const navMeshObstacleDefaultMargin = 8;
  const navMeshObstacleDefaultRefreshFrames = 10;

  const navMeshLinkDefaultTargetOffset = 128;
  const navMeshLinkDefaultCostMultiplier = 1;
  const navMeshLinkDefaultRefreshFrames = 10;

  const navMeshAgentDefaultSpeed = 220;
  const navMeshAgentDefaultAcceleration = 900;
  const navMeshAgentDefaultStoppingDistance = 12;
  const navMeshAgentDefaultRepathIntervalSeconds = 0.35;
  const navMeshAgentWaypointEpsilon = 0.5;
  const navMeshAgentDefaultAvoidanceRadius = 48;
  const navMeshAgentDefaultAvoidanceStrength = 0.45;
  const navMeshAgentDefaultDebugPathColor = 0x00e5ff;
  const navMeshAgentDebugPathOpacity = 0.92;
  const navMeshAgentDebugPathZOffset = 1.5;
  const navMeshAgentProgressEpsilon = 0.25;
  const navMeshAgentStuckCheckMinSeconds = 0.25;

  const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));
  const quant = (value: number): number => Math.round(value * 1000);
  const vertexKey = (v: THREE.Vector3): string =>
    `${quant(v.x)}|${quant(v.y)}|${quant(v.z)}`;
  const edgeKey = (a: THREE.Vector3, b: THREE.Vector3): string => {
    const keyA = vertexKey(a);
    const keyB = vertexKey(b);
    return keyA < keyB ? `${keyA}__${keyB}` : `${keyB}__${keyA}`;
  };
  const object3DSignature = (object3D: THREE.Object3D | null): string => {
    if (!object3D) return '';
    object3D.updateWorldMatrix(true, false);
    return object3D.matrixWorld.elements
      .map((value) => Math.round(value * 100) / 100)
      .join('|');
  };

  export class NavMesh3DManager {
    private _surfaces = new Set<NavMeshSurfaceRuntimeBehavior>();
    private _obstacles = new Set<NavMeshObstacleRuntimeBehavior>();
    private _links = new Set<NavMeshLinkRuntimeBehavior>();
    private _agents = new Set<NavMeshAgentRuntimeBehavior>();
    private _dirtyLayers = new Set<string>();
    private _layerData = new Map<string, LayerNavData>();

    private static _up = new THREE.Vector3(0, 0, 1);
    private static _triangle = new THREE.Triangle();
    private static _closest = new THREE.Vector3();
    private static _obstacleTriangle = new THREE.Triangle();

    static getManager(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): NavMesh3DManager {
      if (!instanceContainer.navMesh3DManager) {
        instanceContainer.navMesh3DManager = new gdjs.NavMesh3DManager();
      }
      return instanceContainer.navMesh3DManager;
    }

    addSurface(surface: NavMeshSurfaceRuntimeBehavior): void {
      this._surfaces.add(surface);
      this.markDirty(surface.getOwnerLayerName());
    }

    removeSurface(surface: NavMeshSurfaceRuntimeBehavior): void {
      if (!this._surfaces.delete(surface)) return;
      this.markDirty(surface.getOwnerLayerName());
    }

    addObstacle(obstacle: NavMeshObstacleRuntimeBehavior): void {
      this._obstacles.add(obstacle);
      this.markDirty(obstacle.getOwnerLayerName());
    }

    removeObstacle(obstacle: NavMeshObstacleRuntimeBehavior): void {
      if (!this._obstacles.delete(obstacle)) return;
      this.markDirty(obstacle.getOwnerLayerName());
    }

    addLink(link: NavMeshLinkRuntimeBehavior): void {
      this._links.add(link);
      this.markDirty(link.getOwnerLayerName());
    }

    removeLink(link: NavMeshLinkRuntimeBehavior): void {
      if (!this._links.delete(link)) return;
      this.markDirty(link.getOwnerLayerName());
    }

    addAgent(agent: NavMeshAgentRuntimeBehavior): void {
      this._agents.add(agent);
    }

    removeAgent(agent: NavMeshAgentRuntimeBehavior): void {
      this._agents.delete(agent);
    }

    markDirty(layerName: string): void {
      this._dirtyLayers.add(layerName || '');
    }

    findPath(
      layerName: string,
      start: THREE.Vector3,
      end: THREE.Vector3
    ): THREE.Vector3[] | null {
      const normalizedLayer = layerName || '';
      const data = this._getLayerData(normalizedLayer);
      if (!data || data.triangles.length === 0) return null;

      const startMatch = this._closestTriangle(data.triangles, start);
      const endMatch = this._closestTriangle(data.triangles, end);
      if (!startMatch || !endMatch) return null;

      const linkEdges = this._resolveLinkEdges(normalizedLayer, data.triangles);
      const route = this._aStar(
        data.triangles,
        startMatch.index,
        endMatch.index,
        linkEdges
      );
      if (!route) return null;

      const points: THREE.Vector3[] = [startMatch.point.clone()];
      for (let i = 1; i < route.triangles.length; i++) {
        const triangleIndex = route.triangles[i];
        const via = route.viaByNode.get(triangleIndex);
        if (via) {
          if (
            points[points.length - 1].distanceToSquared(via.startPoint) >
            navMeshPointEpsilonSq
          ) {
            points.push(via.startPoint.clone());
          }
          points.push(via.endPoint.clone());
          continue;
        }

        if (i < route.triangles.length - 1) {
          points.push(data.triangles[triangleIndex].centroid.clone());
        }
      }
      points.push(endMatch.point.clone());
      this._simplify(points);
      this._deduplicate(points);
      return points;
    }

    computeAvoidance(
      agent: NavMeshAgentRuntimeBehavior,
      position: THREE.Vector3,
      radius: number
    ): THREE.Vector3 {
      const force = new THREE.Vector3();
      if (radius <= 0) return force;
      const radiusSq = radius * radius;

      for (const other of this._agents.values()) {
        if (other === agent) continue;
        if (!other.isEnabled() || !other.isMoving()) continue;
        const otherPosition = other.getCurrentPositionForAvoidance();
        const dx = position.x - otherPosition.x;
        const dy = position.y - otherPosition.y;
        const dz = position.z - otherPosition.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq <= 1e-6 || distSq > radiusSq) continue;

        const dist = Math.sqrt(distSq);
        const weight = (radius - dist) / radius;
        force.x += (dx / dist) * weight;
        force.y += (dy / dist) * weight;
        force.z += (dz / dist) * weight;
      }

      return force;
    }

    private _getLayerData(layerName: string): LayerNavData | null {
      if (!this._layerData.has(layerName) || this._dirtyLayers.has(layerName)) {
        this._dirtyLayers.delete(layerName);
        this._layerData.set(layerName, this._buildLayer(layerName));
      }
      return this._layerData.get(layerName) || null;
    }

    private _buildLayer(layerName: string): LayerNavData {
      const triangles: NavTriangle[] = [];
      const obstacleBoxes = this._collectObstacleVolumes(layerName);

      for (const surface of this._surfaces.values()) {
        if (!surface.isEnabled()) continue;
        if (surface.getOwnerLayerName() !== layerName) continue;

        const root = surface.getOwner3DObject();
        if (!root) continue;
        root.updateWorldMatrix(true, true);

        const minUpDot = Math.cos((surface.getMaxSlope() * Math.PI) / 180);
        root.traverse((candidateObject) => {
          const mesh = candidateObject as THREE.Mesh;
          if (!mesh || !mesh.isMesh || !mesh.geometry) return;

          const geometry = mesh.geometry as THREE.BufferGeometry;
          const positions = geometry.attributes?.position as
            | THREE.BufferAttribute
            | undefined;
          if (!positions || positions.itemSize < 3) return;

          const index = geometry.index;
          const triCount = index
            ? Math.floor(index.count / 3)
            : Math.floor(positions.count / 3);

          const la = new THREE.Vector3();
          const lb = new THREE.Vector3();
          const lc = new THREE.Vector3();
          const wa = new THREE.Vector3();
          const wb = new THREE.Vector3();
          const wc = new THREE.Vector3();
          const edgeAB = new THREE.Vector3();
          const edgeAC = new THREE.Vector3();
          const normal = new THREE.Vector3();
          const crossArea = new THREE.Vector3();

          for (let tri = 0; tri < triCount; tri++) {
            const ia = index ? index.getX(tri * 3) : tri * 3;
            const ib = index ? index.getX(tri * 3 + 1) : tri * 3 + 1;
            const ic = index ? index.getX(tri * 3 + 2) : tri * 3 + 2;

            la.fromBufferAttribute(positions, ia);
            lb.fromBufferAttribute(positions, ib);
            lc.fromBufferAttribute(positions, ic);

            wa.copy(la).applyMatrix4(mesh.matrixWorld);
            wb.copy(lb).applyMatrix4(mesh.matrixWorld);
            wc.copy(lc).applyMatrix4(mesh.matrixWorld);

            edgeAB.copy(wb).sub(wa);
            edgeAC.copy(wc).sub(wa);
            normal.copy(edgeAB).cross(edgeAC).normalize();

            const upDot = normal.dot(NavMesh3DManager._up);
            if (upDot <= 0 || upDot < minUpDot) continue;

            const area = crossArea.copy(edgeAB).cross(edgeAC).length();
            if (area < navMeshTriangleAreaEpsilon) continue;

            const centroid = new THREE.Vector3()
              .add(wa)
              .add(wb)
              .add(wc)
              .multiplyScalar(1 / 3);

            if (
              this._isTriangleBlocked(
                obstacleBoxes,
                wa,
                wb,
                wc
              )
            ) {
              continue;
            }

            triangles.push({
              id: triangles.length,
              a: wa.clone(),
              b: wb.clone(),
              c: wc.clone(),
              centroid,
              neighbors: [],
              cost: Math.max(0.001, surface.getAreaCost()),
            });
          }
        });
      }

      const edges = new Map<string, number[]>();
      for (const triangle of triangles) {
        const keys = [
          edgeKey(triangle.a, triangle.b),
          edgeKey(triangle.b, triangle.c),
          edgeKey(triangle.c, triangle.a),
        ];
        for (const key of keys) {
          if (!edges.has(key)) edges.set(key, []);
          edges.get(key)!.push(triangle.id);
        }
      }

      for (const list of edges.values()) {
        if (list.length < 2) continue;
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = triangles[list[i]];
            const b = triangles[list[j]];
            if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
            if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
          }
        }
      }

      return { triangles };
    }

    private _collectObstacleVolumes(layerName: string): THREE.Box3[] {
      const obstacleBoxes: THREE.Box3[] = [];

      for (const obstacle of this._obstacles.values()) {
        if (!obstacle.isEnabled()) continue;
        if (obstacle.getOwnerLayerName() !== layerName) continue;

        const root = obstacle.getOwner3DObject();
        if (!root) continue;
        root.updateWorldMatrix(true, true);

        const box = new THREE.Box3().setFromObject(root);
        if (box.isEmpty()) continue;
        const margin = Math.max(0, obstacle.getMargin());
        if (margin > 0) box.expandByScalar(margin);
        obstacleBoxes.push(box);
      }

      return obstacleBoxes;
    }

    private _isTriangleBlocked(
      obstacleBoxes: THREE.Box3[],
      a: THREE.Vector3,
      b: THREE.Vector3,
      c: THREE.Vector3
    ): boolean {
      if (obstacleBoxes.length === 0) return false;
      const triangle = NavMesh3DManager._obstacleTriangle.set(a, b, c);
      for (let i = 0; i < obstacleBoxes.length; i++) {
        const box = obstacleBoxes[i];
        const withIntersectionCheck = box as THREE.Box3 & {
          intersectsTriangle?: (triangle: THREE.Triangle) => boolean;
        };
        if (
          typeof withIntersectionCheck.intersectsTriangle === 'function' &&
          withIntersectionCheck.intersectsTriangle(triangle)
        ) {
          return true;
        }
        if (box.containsPoint(a) || box.containsPoint(b) || box.containsPoint(c)) {
          return true;
        }
      }
      return false;
    }

    private _closestTriangle(
      triangles: NavTriangle[],
      point: THREE.Vector3
    ): ClosestTriangleMatch | null {
      let bestIndex = -1;
      let bestDistanceSq = Number.POSITIVE_INFINITY;
      let bestPoint: THREE.Vector3 | null = null;

      for (let i = 0; i < triangles.length; i++) {
        const tri = triangles[i];
        NavMesh3DManager._triangle.set(tri.a, tri.b, tri.c);
        NavMesh3DManager._triangle.closestPointToPoint(
          point,
          NavMesh3DManager._closest
        );

        const distanceSq = point.distanceToSquared(NavMesh3DManager._closest);
        if (distanceSq < bestDistanceSq) {
          bestDistanceSq = distanceSq;
          bestIndex = i;
          bestPoint = NavMesh3DManager._closest.clone();
        }
      }

      if (bestIndex < 0 || !bestPoint) return null;
      return { index: bestIndex, point: bestPoint };
    }

    private _resolveLinkEdges(
      layerName: string,
      triangles: NavTriangle[]
    ): Map<number, ResolvedLinkEdge[]> {
      const edgesByTriangle = new Map<number, ResolvedLinkEdge[]>();
      if (triangles.length === 0) return edgesByTriangle;

      for (const link of this._links.values()) {
        if (!link.isEnabled()) continue;
        if (link.getOwnerLayerName() !== layerName) continue;

        const start = link.getStartPoint();
        const end = link.getEndPoint();
        if (start.distanceToSquared(end) <= navMeshPointEpsilonSq) continue;

        const startMatch = this._closestTriangle(triangles, start);
        const endMatch = this._closestTriangle(triangles, end);
        if (!startMatch || !endMatch) continue;
        if (startMatch.index === endMatch.index) continue;

        const costMultiplier = clamp(link.getCostMultiplier(), 0.01, 100);
        this._pushLinkEdge(edgesByTriangle, startMatch.index, {
          to: endMatch.index,
          startPoint: startMatch.point.clone(),
          endPoint: endMatch.point.clone(),
          costMultiplier,
        });

        if (link.isBidirectional()) {
          this._pushLinkEdge(edgesByTriangle, endMatch.index, {
            to: startMatch.index,
            startPoint: endMatch.point.clone(),
            endPoint: startMatch.point.clone(),
            costMultiplier,
          });
        }
      }

      return edgesByTriangle;
    }

    private _pushLinkEdge(
      edgesByTriangle: Map<number, ResolvedLinkEdge[]>,
      from: number,
      edge: ResolvedLinkEdge
    ): void {
      if (!edgesByTriangle.has(from)) edgesByTriangle.set(from, []);
      edgesByTriangle.get(from)!.push(edge);
    }

    private _aStar(
      triangles: NavTriangle[],
      start: number,
      goal: number,
      linkEdgesByTriangle: Map<number, ResolvedLinkEdge[]>
    ): AStarRoute | null {
      if (start === goal) {
        return { triangles: [start], viaByNode: new Map() };
      }

      const open = new Set<number>([start]);
      const cameFrom = new Map<number, number>();
      const cameVia = new Map<number, ResolvedLinkEdge>();
      const gScore = new Map<number, number>([[start, 0]]);
      const fScore = new Map<number, number>([
        [start, triangles[start].centroid.distanceTo(triangles[goal].centroid)],
      ]);

      while (open.size > 0) {
        let current = -1;
        let bestF = Number.POSITIVE_INFINITY;
        for (const idx of open.values()) {
          const f = fScore.get(idx);
          if (f === undefined) continue;
          if (f < bestF) {
            bestF = f;
            current = idx;
          }
        }

        if (current < 0) break;
        if (current === goal) {
          const path = [current];
          while (cameFrom.has(current)) {
            current = cameFrom.get(current)!;
            path.push(current);
          }
          path.reverse();
          return { triangles: path, viaByNode: cameVia };
        }

        open.delete(current);
        const currentTri = triangles[current];
        const currentG = gScore.get(current) || 0;

        const relax = (
          neighbor: number,
          stepCost: number,
          viaEdge: ResolvedLinkEdge | null
        ) => {
          const tentativeG = currentG + stepCost;
          const knownG = gScore.get(neighbor);
          if (knownG !== undefined && tentativeG >= knownG) return;

          cameFrom.set(neighbor, current);
          if (viaEdge) cameVia.set(neighbor, viaEdge);
          else cameVia.delete(neighbor);

          gScore.set(neighbor, tentativeG);
          fScore.set(
            neighbor,
            tentativeG + triangles[neighbor].centroid.distanceTo(triangles[goal].centroid)
          );
          open.add(neighbor);
        };

        for (const neighbor of currentTri.neighbors) {
          const neighborTri = triangles[neighbor];
          const stepCost =
            currentTri.centroid.distanceTo(neighborTri.centroid) *
            (currentTri.cost + neighborTri.cost) *
            0.5;
          relax(neighbor, stepCost, null);
        }

        const linkEdges = linkEdgesByTriangle.get(current);
        if (linkEdges && linkEdges.length > 0) {
          for (const edge of linkEdges) {
            const targetTri = triangles[edge.to];
            const linkTravelCost =
              currentTri.centroid.distanceTo(edge.startPoint) +
              edge.startPoint.distanceTo(edge.endPoint) +
              edge.endPoint.distanceTo(targetTri.centroid);
            relax(
              edge.to,
              linkTravelCost * clamp(edge.costMultiplier, 0.01, 100),
              edge
            );
          }
        }
      }

      return null;
    }

    private _simplify(points: THREE.Vector3[]): void {
      if (points.length <= 2) return;
      for (let i = 1; i < points.length - 1; ) {
        const a = points[i - 1];
        const b = points[i];
        const c = points[i + 1];
        const ab = b.clone().sub(a);
        const bc = c.clone().sub(b);
        if (ab.lengthSq() < 1e-6 || bc.lengthSq() < 1e-6) {
          points.splice(i, 1);
          continue;
        }
        const dot = ab.normalize().dot(bc.normalize());
        if (dot > 0.999) {
          points.splice(i, 1);
          continue;
        }
        i++;
      }
    }

    private _deduplicate(points: THREE.Vector3[]): void {
      if (points.length <= 1) return;
      for (let i = 1; i < points.length; ) {
        if (points[i].distanceToSquared(points[i - 1]) <= navMeshPointEpsilonSq) {
          points.splice(i, 1);
          continue;
        }
        i++;
      }
    }
  }

  /**
   * @category Behaviors > 3D
   */
  export class NavMeshSurfaceRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _enabled: boolean;
    private _maxSlope: number;
    private _areaCost: number;
    private _dynamic: boolean;
    private _refreshIntervalFrames: number;
    private _refreshCounter: number;
    private _lastSignature: string;
    private _registeredInManager: boolean;
    private _manager: NavMesh3DManager;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);
      this._enabled =
        behaviorData.enabled === undefined ? true : !!behaviorData.enabled;
      this._maxSlope = clamp(
        behaviorData.maxSlope !== undefined
          ? behaviorData.maxSlope
          : navMeshSurfaceDefaultMaxSlope,
        0,
        89.9
      );
      this._areaCost = Math.max(
        0.001,
        behaviorData.areaCost !== undefined
          ? behaviorData.areaCost
          : navMeshSurfaceDefaultAreaCost
      );
      this._dynamic =
        behaviorData.dynamic === undefined ? true : !!behaviorData.dynamic;
      this._refreshIntervalFrames = Math.max(
        1,
        Math.round(
          behaviorData.refreshIntervalFrames !== undefined
            ? behaviorData.refreshIntervalFrames
            : navMeshSurfaceDefaultRefreshFrames
        )
      );
      this._refreshCounter = this._refreshIntervalFrames;
      this._lastSignature = '';
      this._registeredInManager = false;
      this._manager = gdjs.NavMesh3DManager.getManager(instanceContainer);
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.enabled !== undefined) this.setEnabled(!!behaviorData.enabled);
      if (behaviorData.maxSlope !== undefined) this.setMaxSlope(behaviorData.maxSlope);
      if (behaviorData.areaCost !== undefined) this.setAreaCost(behaviorData.areaCost);
      if (behaviorData.dynamic !== undefined) this.setDynamic(!!behaviorData.dynamic);
      if (behaviorData.refreshIntervalFrames !== undefined) {
        this.setRefreshIntervalFrames(behaviorData.refreshIntervalFrames);
      }
      return true;
    }

    override onCreated(): void {
      // Registration is handled in `doStepPreEvents`
      // to ensure the owner object is fully initialized.
    }

    override onActivate(): void {
      if (this._registeredInManager) return;
      this._manager.addSurface(this);
      this._registeredInManager = true;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    override onDeActivate(): void {
      if (!this._registeredInManager) return;
      this._manager.removeSurface(this);
      this._registeredInManager = false;
    }

    override onDestroy(): void {
      if (!this._registeredInManager) return;
      this._manager.removeSurface(this);
      this._registeredInManager = false;
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {
      if (!this.activated()) {
        if (this._registeredInManager) {
          this._manager.removeSurface(this);
          this._registeredInManager = false;
        }
        return;
      }

      if (!this._registeredInManager) {
        this._lastSignature = this._computeSignature();
        this._refreshCounter = this._refreshIntervalFrames;
        this._manager.addSurface(this);
        this._registeredInManager = true;
        this._manager.markDirty(this.getOwnerLayerName());
      }

      if (!this._enabled || !this._dynamic) return;
      if (this._refreshCounter >= this._refreshIntervalFrames) {
        this._refreshCounter = 0;
        const nextSignature = this._computeSignature();
        if (nextSignature !== this._lastSignature) {
          this._lastSignature = nextSignature;
          this._manager.markDirty(this.getOwnerLayerName());
        }
      } else {
        this._refreshCounter++;
      }
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    setEnabled(enabled: boolean): void {
      const normalized = !!enabled;
      if (normalized === this._enabled) return;
      this._enabled = normalized;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getMaxSlope(): number {
      return this._maxSlope;
    }

    setMaxSlope(maxSlope: number): void {
      const nextValue = clamp(maxSlope, 0, 89.9);
      if (nextValue === this._maxSlope) return;
      this._maxSlope = nextValue;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getAreaCost(): number {
      return this._areaCost;
    }

    setAreaCost(areaCost: number): void {
      const nextValue = Math.max(0.001, areaCost);
      if (nextValue === this._areaCost) return;
      this._areaCost = nextValue;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    isDynamic(): boolean {
      return this._dynamic;
    }

    setDynamic(dynamic: boolean): void {
      this._dynamic = !!dynamic;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getRefreshIntervalFrames(): number {
      return this._refreshIntervalFrames;
    }

    setRefreshIntervalFrames(frames: number): void {
      this._refreshIntervalFrames = Math.max(1, Math.round(frames));
      this._refreshCounter = this._refreshIntervalFrames;
    }

    getOwnerLayerName(): string {
      return this.owner.getLayer ? this.owner.getLayer() : '';
    }

    getOwner3DObject(): THREE.Object3D | null {
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      if (!owner || typeof owner.get3DRendererObject !== 'function') return null;
      return owner.get3DRendererObject() || null;
    }

    private _computeSignature(): string {
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      const transformSignature = object3DSignature(this.getOwner3DObject());
      return [
        transformSignature,
        ...[
          this.owner.getX(),
          this.owner.getY(),
          owner.getZ ? owner.getZ() : 0,
          this._maxSlope,
          this._areaCost,
          this._enabled ? 1 : 0,
        ].map((n) => Math.round(n * 100) / 100),
      ]
        .join('|');
    }
  }

  /**
   * @category Behaviors > 3D
   */
  export class NavMeshObstacleRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _enabled: boolean;
    private _margin: number;
    private _dynamic: boolean;
    private _refreshIntervalFrames: number;
    private _refreshCounter: number;
    private _lastSignature: string;
    private _registeredInManager: boolean;
    private _manager: NavMesh3DManager;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);
      this._enabled =
        behaviorData.enabled === undefined ? true : !!behaviorData.enabled;
      this._margin = Math.max(
        0,
        behaviorData.margin !== undefined
          ? behaviorData.margin
          : navMeshObstacleDefaultMargin
      );
      this._dynamic =
        behaviorData.dynamic === undefined ? true : !!behaviorData.dynamic;
      this._refreshIntervalFrames = Math.max(
        1,
        Math.round(
          behaviorData.refreshIntervalFrames !== undefined
            ? behaviorData.refreshIntervalFrames
            : navMeshObstacleDefaultRefreshFrames
        )
      );
      this._refreshCounter = this._refreshIntervalFrames;
      this._lastSignature = '';
      this._registeredInManager = false;
      this._manager = gdjs.NavMesh3DManager.getManager(instanceContainer);
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.enabled !== undefined) this.setEnabled(!!behaviorData.enabled);
      if (behaviorData.margin !== undefined) this.setMargin(behaviorData.margin);
      if (behaviorData.dynamic !== undefined) this.setDynamic(!!behaviorData.dynamic);
      if (behaviorData.refreshIntervalFrames !== undefined) {
        this.setRefreshIntervalFrames(behaviorData.refreshIntervalFrames);
      }
      return true;
    }

    override onCreated(): void {
      // Registration is handled in `doStepPreEvents`
      // to ensure the owner object is fully initialized.
    }

    override onActivate(): void {
      if (this._registeredInManager) return;
      this._manager.addObstacle(this);
      this._registeredInManager = true;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    override onDeActivate(): void {
      if (!this._registeredInManager) return;
      this._manager.removeObstacle(this);
      this._registeredInManager = false;
    }

    override onDestroy(): void {
      if (!this._registeredInManager) return;
      this._manager.removeObstacle(this);
      this._registeredInManager = false;
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {
      if (!this.activated()) {
        if (this._registeredInManager) {
          this._manager.removeObstacle(this);
          this._registeredInManager = false;
        }
        return;
      }

      if (!this._registeredInManager) {
        this._lastSignature = this._computeSignature();
        this._refreshCounter = this._refreshIntervalFrames;
        this._manager.addObstacle(this);
        this._registeredInManager = true;
        this._manager.markDirty(this.getOwnerLayerName());
      }

      if (!this._enabled || !this._dynamic) return;
      if (this._refreshCounter >= this._refreshIntervalFrames) {
        this._refreshCounter = 0;
        const nextSignature = this._computeSignature();
        if (nextSignature !== this._lastSignature) {
          this._lastSignature = nextSignature;
          this._manager.markDirty(this.getOwnerLayerName());
        }
      } else {
        this._refreshCounter++;
      }
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    setEnabled(enabled: boolean): void {
      const normalized = !!enabled;
      if (normalized === this._enabled) return;
      this._enabled = normalized;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getMargin(): number {
      return this._margin;
    }

    setMargin(margin: number): void {
      const nextValue = Math.max(0, margin);
      if (nextValue === this._margin) return;
      this._margin = nextValue;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    isDynamic(): boolean {
      return this._dynamic;
    }

    setDynamic(dynamic: boolean): void {
      this._dynamic = !!dynamic;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getRefreshIntervalFrames(): number {
      return this._refreshIntervalFrames;
    }

    setRefreshIntervalFrames(frames: number): void {
      this._refreshIntervalFrames = Math.max(1, Math.round(frames));
      this._refreshCounter = this._refreshIntervalFrames;
    }

    getOwnerLayerName(): string {
      return this.owner.getLayer ? this.owner.getLayer() : '';
    }

    getOwner3DObject(): THREE.Object3D | null {
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      if (!owner || typeof owner.get3DRendererObject !== 'function') return null;
      return owner.get3DRendererObject() || null;
    }

    private _computeSignature(): string {
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      const transformSignature = object3DSignature(this.getOwner3DObject());
      return [
        transformSignature,
        ...[
          this.owner.getX(),
          this.owner.getY(),
          owner.getZ ? owner.getZ() : 0,
          this._margin,
          this._enabled ? 1 : 0,
        ].map((n) => Math.round(n * 100) / 100),
      ]
        .join('|');
    }
  }

  /**
   * @category Behaviors > 3D
   */
  export class NavMeshLinkRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _enabled: boolean;
    private _targetX: number;
    private _targetY: number;
    private _targetZ: number;
    private _bidirectional: boolean;
    private _costMultiplier: number;
    private _dynamic: boolean;
    private _refreshIntervalFrames: number;
    private _refreshCounter: number;
    private _lastSignature: string;
    private _registeredInManager: boolean;
    private _manager: NavMesh3DManager;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);
      const owner3D = owner as RuntimeObjectWith3DRenderer;
      const defaultTargetX = owner.getX() + navMeshLinkDefaultTargetOffset;
      const defaultTargetY = owner.getY();
      const defaultTargetZ = owner3D.getZ ? owner3D.getZ() : 0;

      this._enabled =
        behaviorData.enabled === undefined ? true : !!behaviorData.enabled;
      this._targetX =
        behaviorData.targetX !== undefined ? behaviorData.targetX : defaultTargetX;
      this._targetY =
        behaviorData.targetY !== undefined ? behaviorData.targetY : defaultTargetY;
      this._targetZ =
        behaviorData.targetZ !== undefined ? behaviorData.targetZ : defaultTargetZ;
      this._bidirectional =
        behaviorData.bidirectional === undefined
          ? true
          : !!behaviorData.bidirectional;
      this._costMultiplier = clamp(
        behaviorData.costMultiplier !== undefined
          ? behaviorData.costMultiplier
          : navMeshLinkDefaultCostMultiplier,
        0.01,
        100
      );
      this._dynamic =
        behaviorData.dynamic === undefined ? true : !!behaviorData.dynamic;
      this._refreshIntervalFrames = Math.max(
        1,
        Math.round(
          behaviorData.refreshIntervalFrames !== undefined
            ? behaviorData.refreshIntervalFrames
            : navMeshLinkDefaultRefreshFrames
        )
      );
      this._refreshCounter = this._refreshIntervalFrames;
      this._lastSignature = '';
      this._registeredInManager = false;
      this._manager = gdjs.NavMesh3DManager.getManager(instanceContainer);
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.enabled !== undefined) this.setEnabled(!!behaviorData.enabled);
      if (behaviorData.targetX !== undefined) this.setTargetX(behaviorData.targetX);
      if (behaviorData.targetY !== undefined) this.setTargetY(behaviorData.targetY);
      if (behaviorData.targetZ !== undefined) this.setTargetZ(behaviorData.targetZ);
      if (behaviorData.bidirectional !== undefined) {
        this.setBidirectional(!!behaviorData.bidirectional);
      }
      if (behaviorData.costMultiplier !== undefined) {
        this.setCostMultiplier(behaviorData.costMultiplier);
      }
      if (behaviorData.dynamic !== undefined) this.setDynamic(!!behaviorData.dynamic);
      if (behaviorData.refreshIntervalFrames !== undefined) {
        this.setRefreshIntervalFrames(behaviorData.refreshIntervalFrames);
      }
      return true;
    }

    override onCreated(): void {
      // Registration is handled in `doStepPreEvents`
      // to ensure the owner object is fully initialized.
    }

    override onActivate(): void {
      if (this._registeredInManager) return;
      this._manager.addLink(this);
      this._registeredInManager = true;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    override onDeActivate(): void {
      if (!this._registeredInManager) return;
      this._manager.removeLink(this);
      this._registeredInManager = false;
    }

    override onDestroy(): void {
      if (!this._registeredInManager) return;
      this._manager.removeLink(this);
      this._registeredInManager = false;
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {
      if (!this.activated()) {
        if (this._registeredInManager) {
          this._manager.removeLink(this);
          this._registeredInManager = false;
        }
        return;
      }

      if (!this._registeredInManager) {
        this._lastSignature = this._computeSignature();
        this._refreshCounter = this._refreshIntervalFrames;
        this._manager.addLink(this);
        this._registeredInManager = true;
        this._manager.markDirty(this.getOwnerLayerName());
      }

      if (!this._enabled || !this._dynamic) return;
      if (this._refreshCounter >= this._refreshIntervalFrames) {
        this._refreshCounter = 0;
        const nextSignature = this._computeSignature();
        if (nextSignature !== this._lastSignature) {
          this._lastSignature = nextSignature;
          this._manager.markDirty(this.getOwnerLayerName());
        }
      } else {
        this._refreshCounter++;
      }
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    setEnabled(enabled: boolean): void {
      const normalized = !!enabled;
      if (normalized === this._enabled) return;
      this._enabled = normalized;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getTargetX(): number {
      return this._targetX;
    }

    setTargetX(targetX: number): void {
      if (targetX === this._targetX) return;
      this._targetX = targetX;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getTargetY(): number {
      return this._targetY;
    }

    setTargetY(targetY: number): void {
      if (targetY === this._targetY) return;
      this._targetY = targetY;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getTargetZ(): number {
      return this._targetZ;
    }

    setTargetZ(targetZ: number): void {
      if (targetZ === this._targetZ) return;
      this._targetZ = targetZ;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    setTargetPosition(x: number, y: number, z: number): void {
      this._targetX = x;
      this._targetY = y;
      this._targetZ = z;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    isBidirectional(): boolean {
      return this._bidirectional;
    }

    setBidirectional(bidirectional: boolean): void {
      const normalized = !!bidirectional;
      if (normalized === this._bidirectional) return;
      this._bidirectional = normalized;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getCostMultiplier(): number {
      return this._costMultiplier;
    }

    setCostMultiplier(costMultiplier: number): void {
      const nextValue = clamp(costMultiplier, 0.01, 100);
      if (nextValue === this._costMultiplier) return;
      this._costMultiplier = nextValue;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    isDynamic(): boolean {
      return this._dynamic;
    }

    setDynamic(dynamic: boolean): void {
      this._dynamic = !!dynamic;
      this._manager.markDirty(this.getOwnerLayerName());
    }

    getRefreshIntervalFrames(): number {
      return this._refreshIntervalFrames;
    }

    setRefreshIntervalFrames(frames: number): void {
      this._refreshIntervalFrames = Math.max(1, Math.round(frames));
      this._refreshCounter = this._refreshIntervalFrames;
    }

    getOwnerLayerName(): string {
      return this.owner.getLayer ? this.owner.getLayer() : '';
    }

    getOwner3DObject(): THREE.Object3D | null {
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      if (!owner || typeof owner.get3DRendererObject !== 'function') return null;
      return owner.get3DRendererObject() || null;
    }

    getStartPoint(): THREE.Vector3 {
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      return new THREE.Vector3(
        this.owner.getX(),
        this.owner.getY(),
        owner.getZ ? owner.getZ() : 0
      );
    }

    getEndPoint(): THREE.Vector3 {
      return new THREE.Vector3(this._targetX, this._targetY, this._targetZ);
    }

    private _computeSignature(): string {
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      const transformSignature = object3DSignature(this.getOwner3DObject());
      return [
        transformSignature,
        ...[
          this.owner.getX(),
          this.owner.getY(),
          owner.getZ ? owner.getZ() : 0,
          this._targetX,
          this._targetY,
          this._targetZ,
          this._costMultiplier,
          this._bidirectional ? 1 : 0,
          this._enabled ? 1 : 0,
        ].map((n) => Math.round(n * 100) / 100),
      ]
        .join('|');
    }
  }

  /**
   * @category Behaviors > 3D
   */
  export class NavMeshAgentRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _enabled: boolean;
    private _speed: number;
    private _acceleration: number;
    private _stoppingDistance: number;
    private _autoRepath: boolean;
    private _repathIntervalSeconds: number;
    private _rotateToVelocity: boolean;
    private _projectOnNavMesh: boolean;
    private _avoidanceEnabled: boolean;
    private _avoidanceRadius: number;
    private _avoidanceStrength: number;
    private _debugPathEnabled: boolean;
    private _debugPathColor: number;

    private _destination: THREE.Vector3 | null;
    private _path: THREE.Vector3[];
    private _currentWaypointIndex: number;
    private _moving: boolean;
    private _pathFound: boolean;
    private _remainingDistance: number;
    private _currentSpeed: number;
    private _timeSinceRepath: number;
    private _stuck: boolean;
    private _stuckElapsedSeconds: number;
    private _lastStuckCheckDistance: number;
    private _registeredInManager: boolean;
    private _debugPathLine: THREE.Line | null;
    private _debugPathSignature: string;
    private _debugPathAttachedLayerRenderer: RuntimeLayerRendererWithRequired3D | null;
    private _manager: NavMesh3DManager;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);
      this._enabled =
        behaviorData.enabled === undefined ? true : !!behaviorData.enabled;
      this._speed = Math.max(
        1,
        behaviorData.speed !== undefined
          ? behaviorData.speed
          : navMeshAgentDefaultSpeed
      );
      this._acceleration = Math.max(
        1,
        behaviorData.acceleration !== undefined
          ? behaviorData.acceleration
          : navMeshAgentDefaultAcceleration
      );
      this._stoppingDistance = Math.max(
        0,
        behaviorData.stoppingDistance !== undefined
          ? behaviorData.stoppingDistance
          : navMeshAgentDefaultStoppingDistance
      );
      this._autoRepath =
        behaviorData.autoRepath === undefined ? true : !!behaviorData.autoRepath;
      this._repathIntervalSeconds = Math.max(
        0.05,
        behaviorData.repathIntervalSeconds !== undefined
          ? behaviorData.repathIntervalSeconds
          : navMeshAgentDefaultRepathIntervalSeconds
      );
      this._rotateToVelocity =
        behaviorData.rotateToVelocity === undefined
          ? true
          : !!behaviorData.rotateToVelocity;
      this._projectOnNavMesh =
        behaviorData.projectOnNavMesh === undefined
          ? true
          : !!behaviorData.projectOnNavMesh;
      this._avoidanceEnabled =
        behaviorData.avoidanceEnabled === undefined
          ? true
          : !!behaviorData.avoidanceEnabled;
      this._avoidanceRadius = Math.max(
        0,
        behaviorData.avoidanceRadius !== undefined
          ? behaviorData.avoidanceRadius
          : navMeshAgentDefaultAvoidanceRadius
      );
      this._avoidanceStrength = clamp(
        behaviorData.avoidanceStrength !== undefined
          ? behaviorData.avoidanceStrength
          : navMeshAgentDefaultAvoidanceStrength,
        0,
        2
      );
      this._debugPathEnabled =
        behaviorData.debugPathEnabled === undefined
          ? false
          : !!behaviorData.debugPathEnabled;
      this._debugPathColor = clamp(
        Math.round(
          behaviorData.debugPathColor !== undefined
            ? behaviorData.debugPathColor
            : navMeshAgentDefaultDebugPathColor
        ),
        0,
        0xffffff
      );

      this._destination = null;
      this._path = [];
      this._currentWaypointIndex = 0;
      this._moving = false;
      this._pathFound = false;
      this._remainingDistance = 0;
      this._currentSpeed = 0;
      this._timeSinceRepath = 0;
      this._stuck = false;
      this._stuckElapsedSeconds = 0;
      this._lastStuckCheckDistance = Number.POSITIVE_INFINITY;
      this._registeredInManager = false;
      this._debugPathLine = null;
      this._debugPathSignature = '';
      this._debugPathAttachedLayerRenderer = null;
      this._manager = gdjs.NavMesh3DManager.getManager(instanceContainer);
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.enabled !== undefined) this.setEnabled(!!behaviorData.enabled);
      if (behaviorData.speed !== undefined) this.setSpeed(behaviorData.speed);
      if (behaviorData.acceleration !== undefined) {
        this.setAcceleration(behaviorData.acceleration);
      }
      if (behaviorData.stoppingDistance !== undefined) {
        this.setStoppingDistance(behaviorData.stoppingDistance);
      }
      if (behaviorData.autoRepath !== undefined) {
        this.setAutoRepath(!!behaviorData.autoRepath);
      }
      if (behaviorData.repathIntervalSeconds !== undefined) {
        this.setRepathIntervalSeconds(behaviorData.repathIntervalSeconds);
      }
      if (behaviorData.rotateToVelocity !== undefined) {
        this.setRotateToVelocity(!!behaviorData.rotateToVelocity);
      }
      if (behaviorData.projectOnNavMesh !== undefined) {
        this.setProjectOnNavMesh(!!behaviorData.projectOnNavMesh);
      }
      if (behaviorData.avoidanceEnabled !== undefined) {
        this.setAvoidanceEnabled(!!behaviorData.avoidanceEnabled);
      }
      if (behaviorData.avoidanceRadius !== undefined) {
        this.setAvoidanceRadius(behaviorData.avoidanceRadius);
      }
      if (behaviorData.avoidanceStrength !== undefined) {
        this.setAvoidanceStrength(behaviorData.avoidanceStrength);
      }
      if (behaviorData.debugPathEnabled !== undefined) {
        this.setDebugPathEnabled(!!behaviorData.debugPathEnabled);
      }
      if (behaviorData.debugPathColor !== undefined) {
        this.setDebugPathColor(behaviorData.debugPathColor);
      }
      return true;
    }

    override onCreated(): void {
      // Registration is handled in `doStepPreEvents`
      // to ensure the owner object is fully initialized.
    }

    override onActivate(): void {
      if (this._registeredInManager) return;
      this._manager.addAgent(this);
      this._registeredInManager = true;
      this._syncDebugPathPainter();
    }

    override onDeActivate(): void {
      if (this._registeredInManager) {
        this._manager.removeAgent(this);
        this._registeredInManager = false;
      }
      this._moving = false;
      this._currentSpeed = 0;
      this._syncDebugPathPainter();
    }

    override onDestroy(): void {
      if (this._registeredInManager) {
        this._manager.removeAgent(this);
        this._registeredInManager = false;
      }
      this._disposeDebugPathPainter();
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {
      if (!this.activated()) {
        if (this._registeredInManager) {
          this._manager.removeAgent(this);
          this._registeredInManager = false;
        }
        this._moving = false;
        this._currentSpeed = 0;
        this._resetStuckState();
        this._syncDebugPathPainter();
        return;
      }

      if (!this._registeredInManager) {
        this._manager.addAgent(this);
        this._registeredInManager = true;
      }

      if (!this._enabled) {
        this._moving = false;
        this._currentSpeed = 0;
        this._resetStuckState();
        this._syncDebugPathPainter();
        return;
      }

      if (!this._destination) {
        this._resetStuckState();
        this._syncDebugPathPainter();
        return;
      }

      const dt = Math.max(0, instanceContainer.getElapsedTime() / 1000);
      this._timeSinceRepath += dt;
      if (
        !this._pathFound ||
        (this._autoRepath && this._timeSinceRepath >= this._repathIntervalSeconds)
      ) {
        this._rebuildPath();
      }

      if (!this._moving || this._path.length === 0) {
        this._currentSpeed = 0;
        this._updateStuckState(dt);
        this._syncDebugPathPainter();
        return;
      }

      const position = this._getOwnerPosition();
      const target = this._path[this._currentWaypointIndex];
      if (!target) {
        this._moving = false;
        this._remainingDistance = 0;
        this._updateStuckState(dt);
        this._syncDebugPathPainter();
        return;
      }

      const delta = target.clone().sub(position);
      const distance = delta.length();
      const isLast = this._currentWaypointIndex >= this._path.length - 1;
      if (!isLast && distance <= Math.max(2, this._stoppingDistance * 0.35)) {
        this._currentWaypointIndex++;
        this._updateRemainingDistance();
        this._updateStuckState(dt);
        this._syncDebugPathPainter();
        return;
      }
      if (isLast && distance <= this._stoppingDistance) {
        this._setOwnerPosition(target);
        this._moving = false;
        this._currentSpeed = 0;
        this._remainingDistance = 0;
        this._updateStuckState(dt);
        this._syncDebugPathPainter();
        return;
      }
      if (distance <= navMeshAgentWaypointEpsilon) {
        this._currentWaypointIndex = Math.min(
          this._path.length - 1,
          this._currentWaypointIndex + 1
        );
        this._updateRemainingDistance();
        this._updateStuckState(dt);
        this._syncDebugPathPainter();
        return;
      }

      this._currentSpeed = Math.min(
        this._speed,
        this._currentSpeed + this._acceleration * dt
      );
      const travel = Math.min(distance, this._currentSpeed * dt);
      const move = delta.multiplyScalar(travel / distance);

      if (this._avoidanceEnabled && this._avoidanceRadius > 0) {
        const avoidance = this._manager.computeAvoidance(
          this,
          position,
          this._avoidanceRadius
        );
        if (avoidance.lengthSq() > 1e-6) {
          const bias = avoidance
            .normalize()
            .multiplyScalar(travel * this._avoidanceStrength);
          move.add(bias);
          const maxMove = Math.max(travel, this._speed * dt);
          const len = move.length();
          if (len > maxMove && len > 0) move.multiplyScalar(maxMove / len);
        }
      }

      this._moveOwnerBy(move);
      if (this._rotateToVelocity) {
        const len2 = move.x * move.x + move.y * move.y;
        if (len2 > 0.0001) {
          this.owner.setAngle(gdjs.toDegrees(Math.atan2(move.y, move.x)));
        }
      }
      this._updateRemainingDistance();
      this._updateStuckState(dt);
      this._syncDebugPathPainter();
    }

    setDestination(x: number, y: number, z: number): void {
      this._destination = new THREE.Vector3(x, y, z);
      this._timeSinceRepath = this._repathIntervalSeconds;
      this._resetStuckState();
      this._rebuildPath();
      this._syncDebugPathPainter();
    }

    clearDestination(): void {
      this._destination = null;
      this._path = [];
      this._moving = false;
      this._pathFound = false;
      this._remainingDistance = 0;
      this._currentSpeed = 0;
      this._resetStuckState();
      this._syncDebugPathPainter();
    }

    forceRepath(): void {
      if (!this._destination) return;
      this._timeSinceRepath = this._repathIntervalSeconds;
      this._resetStuckState();
      this._rebuildPath();
      this._syncDebugPathPainter();
    }

    destinationReached(): boolean {
      return !!this._destination && this._pathFound && !this._moving;
    }

    isMoving(): boolean {
      return this._moving;
    }

    isPathFound(): boolean {
      return this._pathFound;
    }

    getRemainingDistance(): number {
      return this._remainingDistance;
    }

    hasDestination(): boolean {
      return this._destination !== null;
    }

    isStuck(): boolean {
      return this._stuck;
    }

    movementAngleIsAround(angle: number, tolerance: number): boolean {
      const currentAngle = this.getMovementAngle();
      const normalizedDelta = ((((currentAngle - angle) % 360) + 540) % 360) - 180;
      return Math.abs(normalizedDelta) <= Math.abs(tolerance);
    }

    getMovementAngle(): number {
      const fallbackAngle =
        typeof this.owner.getAngle === 'function' ? this.owner.getAngle() : 0;
      if (!this._moving || this._path.length === 0) return fallbackAngle;

      const from = this._getOwnerPosition();
      const to =
        this._path[this.getNextNodeIndex()] ||
        this._destination ||
        this._getOwnerPosition();
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (dx * dx + dy * dy <= 1e-6) return fallbackAngle;
      return gdjs.toDegrees(Math.atan2(dy, dx));
    }

    getDestinationX(): number {
      if (this._destination) return this._destination.x;
      return this._getOwnerPosition().x;
    }

    getDestinationY(): number {
      if (this._destination) return this._destination.y;
      return this._getOwnerPosition().y;
    }

    getDestinationZ(): number {
      if (this._destination) return this._destination.z;
      return this._getOwnerPosition().z;
    }

    getNodeCount(): number {
      return this._path.length;
    }

    getNextNodeIndex(): number {
      if (this._path.length === 0) return 0;
      return clamp(this._currentWaypointIndex, 0, this._path.length - 1);
    }

    getNodeX(index: number): number {
      return this._getNodeValue(index, 'x');
    }

    getNodeY(index: number): number {
      return this._getNodeValue(index, 'y');
    }

    getNodeZ(index: number): number {
      return this._getNodeValue(index, 'z');
    }

    getNextNodeX(): number {
      return this.getNodeX(this.getNextNodeIndex());
    }

    getNextNodeY(): number {
      return this.getNodeY(this.getNextNodeIndex());
    }

    getNextNodeZ(): number {
      return this.getNodeZ(this.getNextNodeIndex());
    }

    getLastNodeX(): number {
      if (this._path.length === 0) return this.getDestinationX();
      return this._path[this._path.length - 1].x;
    }

    getLastNodeY(): number {
      if (this._path.length === 0) return this.getDestinationY();
      return this._path[this._path.length - 1].y;
    }

    getLastNodeZ(): number {
      if (this._path.length === 0) return this.getDestinationZ();
      return this._path[this._path.length - 1].z;
    }

    setEnabled(enabled: boolean): void {
      this._enabled = !!enabled;
      if (!this._enabled) {
        this._moving = false;
        this._currentSpeed = 0;
      }
      this._syncDebugPathPainter();
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    setSpeed(speed: number): void {
      this._speed = Math.max(1, speed);
    }

    getSpeed(): number {
      return this._speed;
    }

    setAcceleration(acceleration: number): void {
      this._acceleration = Math.max(1, acceleration);
    }

    getAcceleration(): number {
      return this._acceleration;
    }

    setStoppingDistance(distance: number): void {
      this._stoppingDistance = Math.max(0, distance);
    }

    getStoppingDistance(): number {
      return this._stoppingDistance;
    }

    setAutoRepath(autoRepath: boolean): void {
      this._autoRepath = !!autoRepath;
    }

    isAutoRepath(): boolean {
      return this._autoRepath;
    }

    setRepathIntervalSeconds(seconds: number): void {
      this._repathIntervalSeconds = Math.max(0.05, seconds);
    }

    getRepathIntervalSeconds(): number {
      return this._repathIntervalSeconds;
    }

    setRotateToVelocity(rotate: boolean): void {
      this._rotateToVelocity = !!rotate;
    }

    isRotateToVelocity(): boolean {
      return this._rotateToVelocity;
    }

    setProjectOnNavMesh(projectOnNavMesh: boolean): void {
      this._projectOnNavMesh = !!projectOnNavMesh;
    }

    isProjectOnNavMesh(): boolean {
      return this._projectOnNavMesh;
    }

    setAvoidanceEnabled(enabled: boolean): void {
      this._avoidanceEnabled = !!enabled;
    }

    isAvoidanceEnabled(): boolean {
      return this._avoidanceEnabled;
    }

    setAvoidanceRadius(radius: number): void {
      this._avoidanceRadius = Math.max(0, radius);
    }

    getAvoidanceRadius(): number {
      return this._avoidanceRadius;
    }

    setAvoidanceStrength(strength: number): void {
      this._avoidanceStrength = clamp(strength, 0, 2);
    }

    getAvoidanceStrength(): number {
      return this._avoidanceStrength;
    }

    setDebugPathEnabled(enabled: boolean): void {
      const normalized = !!enabled;
      if (normalized === this._debugPathEnabled) return;
      this._debugPathEnabled = normalized;
      if (!normalized) {
        this._setDebugPathPainterVisible(false);
        this._detachDebugPathPainter();
      } else {
        this._syncDebugPathPainter();
      }
    }

    isDebugPathEnabled(): boolean {
      return this._debugPathEnabled;
    }

    setDebugPathColor(color: number): void {
      const nextValue = clamp(Math.round(color), 0, 0xffffff);
      if (nextValue === this._debugPathColor) return;
      this._debugPathColor = nextValue;
      this._debugPathSignature = '';
      this._syncDebugPathPainter();
    }

    getDebugPathColor(): number {
      return this._debugPathColor;
    }

    getCurrentPositionForAvoidance(): THREE.Vector3 {
      return this._getOwnerPosition();
    }

    private _getOwnerLayerRendererWith3D():
      | RuntimeLayerRendererWithRequired3D
      | null {
      const runtimeScene = this.owner.getRuntimeScene();
      if (!runtimeScene) return null;

      const layerName = this.owner.getLayer ? this.owner.getLayer() : '';
      const layer = runtimeScene.getLayer(layerName);
      if (!layer) return null;

      const layerRenderer = layer.getRenderer() as RuntimeLayerRendererWith3D;
      if (
        !layerRenderer ||
        typeof layerRenderer.add3DRendererObject !== 'function' ||
        typeof layerRenderer.remove3DRendererObject !== 'function'
      ) {
        return null;
      }

      return layerRenderer as RuntimeLayerRendererWithRequired3D;
    }

    private _ensureDebugPathPainterAttachment(): boolean {
      if (!this._debugPathLine) {
        this._debugPathLine = new THREE.Line(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({
            color: this._debugPathColor,
            transparent: true,
            opacity: navMeshAgentDebugPathOpacity,
            depthTest: false,
            depthWrite: false,
          })
        );
        this._debugPathLine.frustumCulled = false;
        this._debugPathLine.renderOrder = 9997;
        this._debugPathLine.visible = false;
      }

      const layerRenderer = this._getOwnerLayerRendererWith3D();
      if (!layerRenderer) {
        this._detachDebugPathPainter();
        return false;
      }

      if (
        this._debugPathAttachedLayerRenderer &&
        this._debugPathAttachedLayerRenderer !== layerRenderer
      ) {
        this._debugPathAttachedLayerRenderer.remove3DRendererObject(
          this._debugPathLine
        );
      }

      if (
        this._debugPathLine.parent === null ||
        this._debugPathAttachedLayerRenderer !== layerRenderer
      ) {
        layerRenderer.add3DRendererObject(this._debugPathLine);
      }

      this._debugPathAttachedLayerRenderer = layerRenderer;
      return true;
    }

    private _detachDebugPathPainter(): void {
      if (this._debugPathLine && this._debugPathAttachedLayerRenderer) {
        this._debugPathAttachedLayerRenderer.remove3DRendererObject(
          this._debugPathLine
        );
      }
      if (this._debugPathLine) {
        this._debugPathLine.removeFromParent();
      }
      this._debugPathAttachedLayerRenderer = null;
    }

    private _disposeDebugPathPainter(): void {
      this._detachDebugPathPainter();
      if (this._debugPathLine) {
        this._debugPathLine.geometry.dispose();
        const material = this._debugPathLine.material as THREE.LineBasicMaterial;
        material.dispose();
      }
      this._debugPathLine = null;
      this._debugPathSignature = '';
    }

    private _setDebugPathPainterVisible(visible: boolean): void {
      if (!this._debugPathLine) return;
      this._debugPathLine.visible = visible;
      if (!visible) this._debugPathSignature = '';
    }

    private _buildDebugPathPoints(): THREE.Vector3[] {
      const points: THREE.Vector3[] = [];
      const ownerPoint = this._getOwnerPosition();
      ownerPoint.z += navMeshAgentDebugPathZOffset;
      points.push(ownerPoint);

      if (this._path.length > 0 && this._pathFound) {
        const startIndex =
          this._path.length > 0
            ? clamp(this._currentWaypointIndex, 0, this._path.length - 1)
            : 0;
        for (let i = startIndex; i < this._path.length; i++) {
          const node = this._path[i];
          points.push(
            new THREE.Vector3(
              node.x,
              node.y,
              node.z + navMeshAgentDebugPathZOffset
            )
          );
        }
      }

      if (this._destination) {
        const destinationPoint = this._destination.clone();
        destinationPoint.z += navMeshAgentDebugPathZOffset;
        const lastPoint = points[points.length - 1];
        if (
          !lastPoint ||
          lastPoint.distanceToSquared(destinationPoint) > navMeshPointEpsilonSq
        ) {
          points.push(destinationPoint);
        }
      }

      return points;
    }

    private _buildDebugPathSignature(points: THREE.Vector3[]): string {
      const color = clamp(Math.round(this._debugPathColor), 0, 0xffffff);
      return (
        color.toString(16) +
        '|' +
        points.map((point) => `${quant(point.x)}:${quant(point.y)}:${quant(point.z)}`).join(';')
      );
    }

    private _syncDebugPathPainter(): void {
      if (!this._debugPathEnabled || !this.activated()) {
        this._setDebugPathPainterVisible(false);
        this._detachDebugPathPainter();
        return;
      }

      if (!this._ensureDebugPathPainterAttachment() || !this._debugPathLine) {
        return;
      }

      const points = this._buildDebugPathPoints();
      if (points.length < 2) {
        this._setDebugPathPainterVisible(false);
        return;
      }

      const signature = this._buildDebugPathSignature(points);
      if (signature === this._debugPathSignature) {
        this._setDebugPathPainterVisible(true);
        return;
      }

      this._debugPathSignature = signature;

      const lineMaterial = this._debugPathLine.material as THREE.LineBasicMaterial;
      const nextColor = clamp(Math.round(this._debugPathColor), 0, 0xffffff);
      if (lineMaterial.color.getHex() !== nextColor) {
        lineMaterial.color.setHex(nextColor);
      }

      const oldGeometry = this._debugPathLine.geometry;
      this._debugPathLine.geometry = new THREE.BufferGeometry().setFromPoints(
        points
      );
      oldGeometry.dispose();

      this._setDebugPathPainterVisible(true);
    }

    private _rebuildPath(): void {
      if (!this._destination) return;
      const start = this._getOwnerPosition();
      const layer = this.owner.getLayer ? this.owner.getLayer() : '';
      const nextPath = this._manager.findPath(layer, start, this._destination);
      this._timeSinceRepath = 0;

      if (!nextPath || nextPath.length === 0) {
        this._path = [];
        this._moving = false;
        this._pathFound = false;
        this._remainingDistance = 0;
        this._resetStuckState();
        return;
      }

      this._path = nextPath;
      this._pathFound = true;
      this._moving = true;
      this._currentWaypointIndex = this._path.length > 1 ? 1 : 0;
      if (this._projectOnNavMesh && this._path.length > 0) {
        this._setOwnerPosition(this._path[0]);
      }
      this._updateRemainingDistance();
      this._stuck = false;
      this._stuckElapsedSeconds = 0;
      this._lastStuckCheckDistance = this._remainingDistance;
    }

    private _resetStuckState(): void {
      this._stuck = false;
      this._stuckElapsedSeconds = 0;
      this._lastStuckCheckDistance = Number.POSITIVE_INFINITY;
    }

    private _updateStuckState(dt: number): void {
      if (
        !this._destination ||
        !this._moving ||
        !this._pathFound ||
        this._remainingDistance <= this._stoppingDistance + 0.5
      ) {
        this._resetStuckState();
        return;
      }

      if (!Number.isFinite(this._lastStuckCheckDistance)) {
        this._lastStuckCheckDistance = this._remainingDistance;
        return;
      }

      const progressedBy = this._lastStuckCheckDistance - this._remainingDistance;
      this._lastStuckCheckDistance = this._remainingDistance;
      if (progressedBy > navMeshAgentProgressEpsilon) {
        this._stuck = false;
        this._stuckElapsedSeconds = 0;
        return;
      }

      this._stuckElapsedSeconds += dt;
      const stuckThreshold = Math.max(
        navMeshAgentStuckCheckMinSeconds,
        this._repathIntervalSeconds * 1.5
      );
      if (this._stuckElapsedSeconds < stuckThreshold) {
        this._stuck = false;
        return;
      }

      this._stuck = true;
      this._stuckElapsedSeconds = 0;
      if (
        this._autoRepath &&
        this._timeSinceRepath >= Math.max(0.15, this._repathIntervalSeconds * 0.5)
      ) {
        this._rebuildPath();
      }
    }

    private _getNodeByIndex(index: number): THREE.Vector3 | null {
      if (!Number.isFinite(index)) return null;
      const clampedIndex = Math.floor(index);
      if (clampedIndex < 0 || clampedIndex >= this._path.length) return null;
      return this._path[clampedIndex] || null;
    }

    private _getNodeValue(index: number, component: 'x' | 'y' | 'z'): number {
      const node = this._getNodeByIndex(index);
      if (node) return node[component];
      const fallback = this._getOwnerPosition();
      return fallback[component];
    }

    private _getOwnerPosition(): THREE.Vector3 {
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      return new THREE.Vector3(
        this.owner.getX(),
        this.owner.getY(),
        owner.getZ ? owner.getZ() : 0
      );
    }

    private _setOwnerPosition(position: THREE.Vector3): void {
      this.owner.setX(position.x);
      this.owner.setY(position.y);
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      if (owner.setZ) owner.setZ(position.z);
    }

    private _moveOwnerBy(move: THREE.Vector3): void {
      this.owner.setX(this.owner.getX() + move.x);
      this.owner.setY(this.owner.getY() + move.y);
      const owner = this.owner as RuntimeObjectWith3DRenderer;
      if (owner.setZ) owner.setZ((owner.getZ ? owner.getZ() : 0) + move.z);
    }

    private _updateRemainingDistance(): void {
      if (!this._moving || this._path.length === 0) {
        this._remainingDistance = 0;
        return;
      }
      const current = this._getOwnerPosition();
      let dist = 0;
      let prev = current;
      for (let i = this._currentWaypointIndex; i < this._path.length; i++) {
        dist += prev.distanceTo(this._path[i]);
        prev = this._path[i];
      }
      this._remainingDistance = dist;
    }
  }

  gdjs.registerBehavior(
    'NavMeshBehavior::NavMeshSurfaceBehavior',
    gdjs.NavMeshSurfaceRuntimeBehavior
  );
  gdjs.registerBehavior(
    'NavMeshBehavior::NavMeshObstacleBehavior',
    gdjs.NavMeshObstacleRuntimeBehavior
  );
  gdjs.registerBehavior('NavMeshBehavior::NavMeshLinkBehavior', gdjs.NavMeshLinkRuntimeBehavior);
  gdjs.registerBehavior('NavMeshBehavior::NavMeshAgentBehavior', gdjs.NavMeshAgentRuntimeBehavior);
}

