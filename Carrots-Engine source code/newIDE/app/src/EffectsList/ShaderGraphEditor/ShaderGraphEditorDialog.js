// @flow

import * as React from 'react';
import { Trans, t } from '@lingui/macro';
import Dialog, { DialogPrimaryButton } from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import Text from '../../UI/Text';
import AlertMessage from '../../UI/AlertMessage';
import SemiControlledTextField from '../../UI/SemiControlledTextField';
import EditorMosaic from '../../UI/EditorMosaic';
import GDevelopThemeContext from '../../UI/Theme/GDevelopThemeContext';
import ShaderGraphPreview from './ShaderGraphPreview';
import {
  createDefaultShaderGraph,
  duplicateShaderGraph,
  getShaderGraphDefinitionFromEffect,
  getShaderGraphNodeDefinition,
  getShaderGraphNodeHeight,
  getShaderGraphNodeSummary,
  getShaderGraphPortColor,
  getShaderGraphStrengthFromEffect,
  createShaderGraphNode,
  serializeShaderGraphDefinition,
  shaderGraphTemplates,
  shaderGraphNodePalette,
  shaderGraphPortColors,
  SHADER_GRAPH_CANVAS_HEIGHT,
  SHADER_GRAPH_CANVAS_WIDTH,
  SHADER_GRAPH_DEFINITION_PARAMETER,
  SHADER_GRAPH_ENABLED_PARAMETER,
  SHADER_GRAPH_FRAGMENT_SHADER_PARAMETER,
  SHADER_GRAPH_NODE_HEADER_HEIGHT,
  SHADER_GRAPH_NODE_PORT_HEIGHT,
  SHADER_GRAPH_NODE_WIDTH,
  SHADER_GRAPH_STRENGTH_PARAMETER,
  SHADER_GRAPH_VERSION,
  SHADER_GRAPH_VERSION_PARAMETER,
} from './ShaderGraphModel';
import {
  buildShaderGraphProgram,
  DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER,
  validateGeneratedShader,
} from './ShaderGraphGenerator';

const styles = {
  workspace: {
    height: '100%',
    minHeight: 720,
    background:
      'radial-gradient(circle at 14% 14%, rgba(50, 174, 118, 0.2), rgba(7, 13, 22, 0.96) 36%), radial-gradient(circle at 86% 21%, rgba(255, 150, 64, 0.18), rgba(7, 13, 22, 0.98) 42%), linear-gradient(180deg, rgba(7, 13, 22, 0.96), rgba(6, 10, 19, 1))',
  },
  panel: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    color: '#eef3ff',
  },
  panelHeader: {
    padding: '12px 14px 9px 14px',
    borderBottom: '1px solid rgba(116, 210, 164, 0.18)',
    background:
      'linear-gradient(90deg, rgba(60, 44, 22, 0.54), rgba(18, 63, 46, 0.5))',
  },
  panelBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: 12,
  },
  infoChip: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '3px 9px',
    marginRight: 6,
    marginBottom: 6,
    fontSize: 11,
    letterSpacing: 0.2,
    color: '#d7f9e8',
    background: 'rgba(58, 184, 132, 0.18)',
    border: '1px solid rgba(88, 210, 156, 0.24)',
  },
  templateCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    background:
      'linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015))',
    border: '1px solid rgba(107, 210, 158, 0.2)',
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
    gap: 8,
    marginTop: 10,
  },
  templateButton: {
    borderRadius: 12,
    border: '1px solid rgba(255, 162, 75, 0.34)',
    background: 'rgba(29, 38, 38, 0.82)',
    color: '#eff4ff',
    padding: '8px 10px',
    fontSize: 12,
    textAlign: 'left',
    cursor: 'pointer',
  },
  nodeButton: {
    width: '100%',
    textAlign: 'left',
    borderRadius: 12,
    border: '1px solid rgba(98, 205, 156, 0.22)',
    background: 'rgba(20, 29, 46, 0.86)',
    color: '#eef3ff',
    padding: '9px 10px',
    cursor: 'pointer',
    marginBottom: 6,
  },
  graphToolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  graphHint: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(212, 243, 227, 0.82)',
  },
  graphOuter: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    borderRadius: 16,
    background:
      'radial-gradient(circle at 24% 14%, rgba(59, 180, 133, 0.12), rgba(9, 15, 27, 0.96) 45%)',
    boxShadow: 'inset 0 0 0 1px rgba(103, 213, 161, 0.22)',
  },
  graphStage: {
    position: 'relative',
    transformOrigin: 'top left',
  },
  graphInner: {
    position: 'relative',
    width: SHADER_GRAPH_CANVAS_WIDTH,
    height: SHADER_GRAPH_CANVAS_HEIGHT,
    backgroundImage:
      'linear-gradient(rgba(82, 192, 146, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(82, 192, 146, 0.16) 1px, transparent 1px), linear-gradient(rgba(255, 173, 93, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 173, 93, 0.09) 1px, transparent 1px)',
    backgroundSize: '96px 96px, 96px 96px, 24px 24px, 24px 24px',
  },
  graphGlow: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 26% 22%, rgba(82, 213, 158, 0.16), transparent 30%), radial-gradient(circle at 76% 43%, rgba(255, 163, 82, 0.18), transparent 31%)',
    pointerEvents: 'none',
  },
  nodeCard: {
    position: 'absolute',
    width: SHADER_GRAPH_NODE_WIDTH,
    borderRadius: 16,
    border: '1px solid rgba(176, 198, 238, 0.24)',
    background:
      'linear-gradient(180deg, rgba(20, 28, 47, 0.98), rgba(11, 17, 30, 0.98))',
    boxShadow: '0 16px 24px rgba(0, 0, 0, 0.24)',
    overflow: 'hidden',
    userSelect: 'none',
  },
  nodeHeader: {
    padding: '9px 12px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'grab',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeBody: {
    padding: '8px 9px 0 9px',
  },
  nodeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: SHADER_GRAPH_NODE_PORT_HEIGHT,
    fontSize: 13,
    color: '#e1ebff',
  },
  nodeFooter: {
    padding: '0 10px 10px 10px',
    fontSize: 11,
    color: 'rgba(223, 230, 255, 0.74)',
  },
  port: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    minWidth: 0,
  },
  portDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: '2px solid rgba(235, 243, 255, 0.92)',
    boxSizing: 'border-box',
    boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.08)',
  },
  svgOverlay: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  inspectorCard: {
    padding: 14,
    borderRadius: 16,
    background:
      'linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  fieldLabel: {
    display: 'block',
    fontSize: 12,
    color: 'rgba(226, 233, 255, 0.82)',
    marginBottom: 6,
  },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 10,
    border: '1px solid rgba(110, 211, 161, 0.3)',
    background: 'rgba(7, 13, 24, 0.74)',
    color: '#eef3ff',
    padding: '9px 11px',
    outline: 'none',
    marginTop: 8,
    marginBottom: 2,
  },
  searchMetaText: {
    marginTop: 6,
    fontSize: 11,
    color: 'rgba(206, 234, 219, 0.76)',
  },
  quickResultList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickResultButton: {
    borderRadius: 999,
    border: '1px solid rgba(93, 203, 152, 0.3)',
    background: 'rgba(17, 28, 33, 0.74)',
    color: '#e6f6ee',
    padding: '4px 10px',
    fontSize: 11,
    cursor: 'pointer',
    maxWidth: 190,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  slider: {
    width: '100%',
    accentColor: '#ff9f4f',
  },
  codeBox: {
    borderRadius: 16,
    padding: 14,
    background: '#08101d',
    color: '#cae4ff',
    fontSize: 12,
    lineHeight: 1.55,
    whiteSpace: 'pre',
    overflow: 'auto',
    fontFamily: 'Consolas, "Cascadia Code", monospace',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
    flex: 1,
    minHeight: 0,
  },
  compileLog: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    background: 'rgba(255, 111, 145, 0.12)',
    color: '#ffd8e0',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
  },
};

const shaderGraphPortTypes = Object.keys(shaderGraphPortColors);
const clampGraphZoom = (zoom: number): number => Math.max(0.5, Math.min(1.8, zoom));

const getNodeById = (graph, nodeId) =>
  graph.nodes.find(node => node.id === nodeId) || null;

const getConnectionToInput = (graph, nodeId, inputId) =>
  graph.connections.find(
    connection =>
      connection.toNodeId === nodeId && connection.toPortId === inputId
  ) || null;

const getNodePortPosition = (node, portId, kind) => {
  const definition = getShaderGraphNodeDefinition(node.type);
  const ports = kind === 'input' ? definition.inputs : definition.outputs;
  const index = ports.findIndex(port => port.id === portId);
  const safeIndex = index >= 0 ? index : 0;
  return {
    x: kind === 'input' ? node.x : node.x + SHADER_GRAPH_NODE_WIDTH,
    y:
      node.y +
      SHADER_GRAPH_NODE_HEADER_HEIGHT +
      SHADER_GRAPH_NODE_PORT_HEIGHT * safeIndex +
      SHADER_GRAPH_NODE_PORT_HEIGHT / 2 +
      8,
  };
};

const getBezierPath = (from, to) => {
  const handleOffset = Math.max(80, Math.abs(to.x - from.x) * 0.45);
  return `M ${from.x} ${from.y} C ${from.x + handleOffset} ${from.y}, ${to.x - handleOffset} ${to.y}, ${to.x} ${to.y}`;
};

const updateNodeData = (graph, nodeId, key, value) => ({
  ...graph,
  nodes: graph.nodes.map(node =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...(node.data || {}),
            [key]: value,
          },
        }
      : node
  ),
});

const removeNodeFromGraph = (graph, nodeId) => ({
  ...graph,
  nodes: graph.nodes.filter(node => node.id !== nodeId),
  connections: graph.connections.filter(
    connection =>
      connection.fromNodeId !== nodeId && connection.toNodeId !== nodeId
  ),
});

const addNodeToGraph = (graph, type, selectedNodeId) => {
  const selectedNode = getNodeById(graph, selectedNodeId);
  const x = selectedNode ? selectedNode.x + 320 : 220;
  const y = selectedNode ? selectedNode.y + 40 : 180 + graph.nodes.length * 26;
  const newNode = createShaderGraphNode(type, x, y);
  return {
    ...graph,
    nodes: [...graph.nodes, newNode],
  };
};

type Props = {
  effect: gdEffect,
  previewMode?: 'postfx' | 'material',
  onApply: () => void,
  onClose: () => void,
};

export default function ShaderGraphEditorDialog({
  effect,
  previewMode = 'postfx',
  onApply,
  onClose,
}: Props): React.Node {
  const gdevelopTheme = React.useContext(GDevelopThemeContext);
  const initialGraph = React.useMemo(
    () => duplicateShaderGraph(getShaderGraphDefinitionFromEffect(effect)),
    [effect]
  );
  const initialOutputNode = initialGraph.nodes.find(
    node => node.type === 'output'
  );
  const [graph, setGraph] = React.useState(initialGraph);
  const [selectedNodeId, setSelectedNodeId] = React.useState(
    initialOutputNode ? initialOutputNode.id : initialGraph.nodes[0].id
  );
  const [pendingConnection, setPendingConnection] = React.useState(null);
  const [graphPointer, setGraphPointer] = React.useState({ x: 0, y: 0 });
  const [graphZoom, setGraphZoom] = React.useState(1);
  const [mixStrength, setMixStrength] = React.useState(
    getShaderGraphStrengthFromEffect(effect)
  );
  const [quickSearch, setQuickSearch] = React.useState('');
  const graphOuterRef = React.useRef<?HTMLDivElement>(null);
  const graphInnerRef = React.useRef<?HTMLDivElement>(null);
  const quickSearchInputRef = React.useRef<?HTMLInputElement>(null);
  const dragStateRef = React.useRef(null);
  const panStateRef = React.useRef(null);
  const pendingConnectionRef = React.useRef(null);
  const graphZoomRef = React.useRef<number>(1);
  const interactionFrameRef = React.useRef<?number>(null);
  const lastMousePositionRef = React.useRef(null);

  const shaderCompilationKey = React.useMemo(
    () =>
      JSON.stringify({
        version: graph.version,
        nodes: graph.nodes.map(node => ({
          id: node.id,
          type: node.type,
          data: node.data || {},
        })),
        connections: graph.connections.map(connection => ({
          fromNodeId: connection.fromNodeId,
          fromPortId: connection.fromPortId,
          toNodeId: connection.toNodeId,
          toPortId: connection.toPortId,
        })),
      }),
    [graph.connections, graph.nodes, graph.version]
  );
  const generatedProgram = React.useMemo(
    () => {
      const shaderCompilationPayload = JSON.parse(shaderCompilationKey);
      return buildShaderGraphProgram({
        ...shaderCompilationPayload,
        nodes: shaderCompilationPayload.nodes.map(node => ({
          ...node,
          x: 0,
          y: 0,
        })),
      });
    },
    [shaderCompilationKey]
  );
  const shaderValidation = React.useMemo(
    () => validateGeneratedShader(generatedProgram.fragmentShader),
    [generatedProgram.fragmentShader]
  );
  const graphDiagnostics = React.useMemo(
    () => generatedProgram.diagnostics || [],
    [generatedProgram.diagnostics]
  );
  const blockingErrors = graphDiagnostics.filter(
    diagnostic => diagnostic.severity === 'error'
  );
  const canApply = blockingErrors.length === 0 && shaderValidation.isValid;
  const effectivePreviewShader =
    canApply || !generatedProgram.fragmentShader
      ? generatedProgram.fragmentShader
      : DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER;
  const selectedNode = getNodeById(graph, selectedNodeId);
  const searchKeyword = quickSearch.trim().toLowerCase();

  React.useEffect(
    () => {
      pendingConnectionRef.current = pendingConnection;
    },
    [pendingConnection]
  );

  React.useEffect(
    () => {
      graphZoomRef.current = graphZoom;
    },
    [graphZoom]
  );

  React.useEffect(() => {
    const onKeyDown = event => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'f') {
        return;
      }
      event.preventDefault();
      if (quickSearchInputRef.current) {
        quickSearchInputRef.current.focus();
        quickSearchInputRef.current.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const syncInteractionFrame = React.useCallback(() => {
    if (interactionFrameRef.current) {
      return;
    }

    interactionFrameRef.current = requestAnimationFrame(() => {
      interactionFrameRef.current = null;
      const lastMousePosition = lastMousePositionRef.current;
      const outer = graphOuterRef.current;
      if (!lastMousePosition || !outer) {
        return;
      }

      const rect = outer.getBoundingClientRect();
      const zoom = graphZoomRef.current || 1;
      const nextPointer = {
        x: (lastMousePosition.clientX - rect.left + outer.scrollLeft) / zoom,
        y: (lastMousePosition.clientY - rect.top + outer.scrollTop) / zoom,
      };

      if (pendingConnectionRef.current) {
        setGraphPointer(previousPointer =>
          previousPointer.x === nextPointer.x &&
          previousPointer.y === nextPointer.y
            ? previousPointer
            : nextPointer
        );
      }

      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      setGraph(previousGraph => ({
        ...previousGraph,
        nodes: previousGraph.nodes.map(node =>
          node.id === dragState.nodeId
            ? {
                ...node,
                x:
                  dragState.originX +
                  (lastMousePosition.clientX - dragState.startX) / zoom,
                y:
                  dragState.originY +
                  (lastMousePosition.clientY - dragState.startY) / zoom,
              }
            : node
        ),
      }));
    });
  }, []);

  React.useEffect(
    () => {
      const handleMouseMove = event => {
        const panState = panStateRef.current;
        const outer = graphOuterRef.current;
        if (panState && outer) {
          outer.scrollLeft =
            panState.startScrollLeft - (event.clientX - panState.startX);
          outer.scrollTop =
            panState.startScrollTop - (event.clientY - panState.startY);
        }

        if (!dragStateRef.current && !pendingConnectionRef.current) {
          return;
        }

        lastMousePositionRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
        };
        syncInteractionFrame();
      };

      const handleMouseUp = () => {
        dragStateRef.current = null;
        panStateRef.current = null;
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        if (interactionFrameRef.current) {
          cancelAnimationFrame(interactionFrameRef.current);
          interactionFrameRef.current = null;
        }
      };
    },
    [syncInteractionFrame]
  );

  const zoomGraphAtClientPoint = React.useCallback((nextZoom, clientX, clientY) => {
    const outer = graphOuterRef.current;
    const clampedZoom = clampGraphZoom(nextZoom);
    if (!outer) {
      setGraphZoom(clampedZoom);
      return;
    }

    const previousZoom = graphZoomRef.current || 1;
    const rect = outer.getBoundingClientRect();
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;
    const worldX = (outer.scrollLeft + viewportX) / previousZoom;
    const worldY = (outer.scrollTop + viewportY) / previousZoom;

    setGraphZoom(clampedZoom);
    requestAnimationFrame(() => {
      outer.scrollLeft = worldX * clampedZoom - viewportX;
      outer.scrollTop = worldY * clampedZoom - viewportY;
    });
  }, []);

  const adjustGraphZoom = React.useCallback((zoomFactor: number) => {
    const outer = graphOuterRef.current;
    if (!outer) {
      setGraphZoom(currentZoom => clampGraphZoom(currentZoom * zoomFactor));
      return;
    }
    const rect = outer.getBoundingClientRect();
    zoomGraphAtClientPoint(
      (graphZoomRef.current || 1) * zoomFactor,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }, [zoomGraphAtClientPoint]);

  const handleApply = React.useCallback(
    () => {
      effect.setStringParameter(
        SHADER_GRAPH_DEFINITION_PARAMETER,
        serializeShaderGraphDefinition(graph)
      );
      effect.setStringParameter(
        SHADER_GRAPH_FRAGMENT_SHADER_PARAMETER,
        generatedProgram.fragmentShader
      );
      effect.setStringParameter(
        SHADER_GRAPH_VERSION_PARAMETER,
        `${SHADER_GRAPH_VERSION}`
      );
      effect.setDoubleParameter(SHADER_GRAPH_STRENGTH_PARAMETER, mixStrength);
      if (effect.hasBooleanParameter(SHADER_GRAPH_ENABLED_PARAMETER)) {
        effect.setBooleanParameter(SHADER_GRAPH_ENABLED_PARAMETER, true);
      }
      onApply();
    },
    [effect, graph, generatedProgram.fragmentShader, mixStrength, onApply]
  );

  const handleTemplateApply = React.useCallback(templateFactory => {
    const nextGraph = templateFactory();
    const outputNode = nextGraph.nodes.find(node => node.type === 'output');
    setGraph(nextGraph);
    setSelectedNodeId(outputNode ? outputNode.id : nextGraph.nodes[0].id);
    setPendingConnection(null);
  }, []);

  const handleStartConnection = React.useCallback((nodeId, portId) => {
    setPendingConnection(currentPending =>
      currentPending &&
      currentPending.fromNodeId === nodeId &&
      currentPending.fromPortId === portId
        ? null
        : {
            fromNodeId: nodeId,
            fromPortId: portId,
          }
    );
  }, []);

  const handleInputClick = React.useCallback(
    (nodeId, portId) => {
      if (!pendingConnection) {
        const existingConnection = getConnectionToInput(graph, nodeId, portId);
        if (existingConnection) {
          setGraph(previousGraph => ({
            ...previousGraph,
            connections: previousGraph.connections.filter(
              connection =>
                !(
                  connection.toNodeId === nodeId &&
                  connection.toPortId === portId
                )
            ),
          }));
        }
        return;
      }

      if (pendingConnection.fromNodeId === nodeId) {
        setPendingConnection(null);
        return;
      }

      const sourceNode = getNodeById(graph, pendingConnection.fromNodeId);
      const targetNode = getNodeById(graph, nodeId);
      if (!sourceNode || !targetNode) {
        setPendingConnection(null);
        return;
      }

      const sourcePort = getShaderGraphNodeDefinition(sourceNode.type).outputs.find(
        port => port.id === pendingConnection.fromPortId
      );
      const targetPort = getShaderGraphNodeDefinition(targetNode.type).inputs.find(
        port => port.id === portId
      );
      if (!sourcePort || !targetPort || sourcePort.type !== targetPort.type) {
        setPendingConnection(null);
        return;
      }

      setGraph(previousGraph => ({
        ...previousGraph,
        connections: [
          ...previousGraph.connections.filter(
            connection =>
              !(
                connection.toNodeId === nodeId && connection.toPortId === portId
              )
          ),
          {
            fromNodeId: pendingConnection.fromNodeId,
            fromPortId: pendingConnection.fromPortId,
            toNodeId: nodeId,
            toPortId: portId,
          },
        ],
      }));
      setPendingConnection(null);
    },
    [graph, pendingConnection]
  );

  const copyShaderToClipboard = React.useCallback(() => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      navigator.clipboard.writeText(generatedProgram.fragmentShader);
    }
  }, [generatedProgram.fragmentShader]);

  const focusNodeInGraph = React.useCallback(
    nodeId => {
      const node = getNodeById(graph, nodeId);
      const outer = graphOuterRef.current;
      if (!node || !outer) {
        return;
      }
      const zoom = graphZoomRef.current || 1;
      outer.scrollLeft = Math.max(
        0,
        node.x * zoom - outer.clientWidth / 2 + (SHADER_GRAPH_NODE_WIDTH * zoom) / 2
      );
      outer.scrollTop = Math.max(
        0,
        node.y * zoom - outer.clientHeight / 2 + 110 * zoom
      );
      setSelectedNodeId(nodeId);
    },
    [graph]
  );

  const paletteSections = React.useMemo(() => {
    return shaderGraphNodePalette
      .map(section => ({
        category: section.category,
        nodeTypes: section.nodeTypes.filter(nodeType => {
          if (!searchKeyword) {
            return true;
          }
          const definition = getShaderGraphNodeDefinition(nodeType);
          return (
            definition.title.toLowerCase().includes(searchKeyword) ||
            definition.description.toLowerCase().includes(searchKeyword) ||
            section.category.toLowerCase().includes(searchKeyword)
          );
        }),
      }))
      .filter(section => section.nodeTypes.length > 0);
  }, [searchKeyword]);

  const filteredTemplates = React.useMemo(
    () =>
      shaderGraphTemplates.filter(template => {
        if (!searchKeyword) {
          return true;
        }
        return (
          template.label.toLowerCase().includes(searchKeyword) ||
          template.description.toLowerCase().includes(searchKeyword)
        );
      }),
    [searchKeyword]
  );

  const quickNodeResults = React.useMemo(
    () =>
      graph.nodes
        .map(node => {
          const definition = getShaderGraphNodeDefinition(node.type);
          const summary = getShaderGraphNodeSummary(node) || '';
          return { node, definition, summary };
        })
        .filter(entry => {
          if (!searchKeyword) {
            return false;
          }
          return (
            entry.definition.title.toLowerCase().includes(searchKeyword) ||
            entry.definition.description.toLowerCase().includes(searchKeyword) ||
            entry.summary.toLowerCase().includes(searchKeyword)
          );
        })
        .slice(0, 8),
    [graph.nodes, searchKeyword]
  );

  const renderPalettePanel = React.useCallback(
    () => (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <Text size="block-title">
            <Trans>Blueprint Palette</Trans>
          </Text>
          <input
            ref={quickSearchInputRef}
            type="text"
            value={quickSearch}
            onChange={event => setQuickSearch(event.target.value)}
            placeholder="Search templates, nodes, or graph (Ctrl+F)..."
            style={styles.searchInput}
          />
          <div style={styles.searchMetaText}>
            <Trans>Instant search across templates, palette, and current graph nodes.</Trans>
          </div>
        </div>
        <div style={styles.panelBody}>
          <div style={styles.templateCard}>
            <Text size="block-title">
              <Trans>Quick Templates</Trans>
            </Text>
            <div style={styles.templateGrid}>
              {filteredTemplates.map(template => (
                <button
                  key={template.id}
                  style={styles.templateButton}
                  onClick={() => handleTemplateApply(template.createGraph)}
                  title={template.description}
                >
                  {template.label}
                </button>
              ))}
            </div>
            {filteredTemplates.length === 0 ? (
              <Text size="body2" noMargin>
                <Trans>No template matched the current search.</Trans>
              </Text>
            ) : null}
          </div>

          {paletteSections.length === 0 ? (
            <AlertMessage kind="info">
              <Trans>No nodes match this search.</Trans>
            </AlertMessage>
          ) : (
            paletteSections.map(section => (
              <div key={section.category} style={{ marginBottom: 14 }}>
                <Text size="block-title">{section.category}</Text>
                {section.nodeTypes.map(nodeType => {
                  const definition = getShaderGraphNodeDefinition(nodeType);
                  return (
                    <button
                      key={nodeType}
                      style={styles.nodeButton}
                      onClick={() => {
                        setGraph(previousGraph =>
                          addNodeToGraph(previousGraph, nodeType, selectedNodeId)
                        );
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <strong>{definition.title}</strong>
                        <span
                          style={{
                            ...styles.infoChip,
                            marginRight: 0,
                            marginBottom: 0,
                            background: `${definition.color}22`,
                            borderColor: `${definition.color}66`,
                          }}
                        >
                          {section.category}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          color: 'rgba(222, 232, 253, 0.72)',
                          fontSize: 11,
                        }}
                      >
                        {definition.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    ),
    [filteredTemplates, handleTemplateApply, paletteSections, quickSearch, selectedNodeId]
  );

  const renderGraphPanel = React.useCallback(
    () => (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <div style={styles.graphToolbar}>
            <span style={styles.infoChip}>{graph.nodes.length} nodes</span>
            <span style={styles.infoChip}>
              {graph.connections.length} connections
            </span>
            <span style={styles.infoChip}>
              {pendingConnection ? 'Connecting...' : 'Ready'}
            </span>
            <span style={styles.infoChip}>{`${Math.round(graphZoom * 100)}%`}</span>
            {quickSearch ? (
              <span style={styles.infoChip}>
                {quickNodeResults.length} graph matches
              </span>
            ) : null}
            <FlatButton
              label="-"
              onClick={() => adjustGraphZoom(0.9)}
            />
            <FlatButton
              label="+"
              onClick={() => adjustGraphZoom(1.1)}
            />
            <FlatButton
              label={<Trans>100%</Trans>}
              onClick={() => {
                const outer = graphOuterRef.current;
                if (!outer) {
                  setGraphZoom(1);
                  return;
                }
                const rect = outer.getBoundingClientRect();
                zoomGraphAtClientPoint(
                  1,
                  rect.left + rect.width / 2,
                  rect.top + rect.height / 2
                );
              }}
            />
            <FlatButton
              label={<Trans>Reset Graph</Trans>}
              onClick={() => handleTemplateApply(createDefaultShaderGraph)}
            />
            {quickSearch ? (
              <FlatButton
                label={<Trans>Clear Search</Trans>}
                onClick={() => setQuickSearch('')}
              />
            ) : null}
          </div>
          <p style={styles.graphHint}>
            {pendingConnection ? (
              <Trans>Click any input port to finish the link.</Trans>
            ) : (
              <Trans>Drag nodes to move, Ctrl/Alt + wheel to zoom, Shift + drag to pan, then connect output to input.</Trans>
            )}
          </p>
          {quickNodeResults.length > 0 ? (
            <div style={styles.quickResultList}>
              {quickNodeResults.map(entry => (
                <button
                  key={entry.node.id}
                  style={styles.quickResultButton}
                  onClick={() => focusNodeInGraph(entry.node.id)}
                  title={`${entry.definition.title}${entry.summary ? ` - ${entry.summary}` : ''}`}
                >
                  {entry.definition.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ ...styles.panelBody, display: 'flex', minHeight: 0 }}>
          <div
            ref={graphOuterRef}
            style={styles.graphOuter}
            onClick={() => setPendingConnection(null)}
            onWheel={event => {
              if (!(event.ctrlKey || event.metaKey || event.altKey)) {
                return;
              }
              event.preventDefault();
              const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
              zoomGraphAtClientPoint(
                (graphZoomRef.current || 1) * zoomFactor,
                event.clientX,
                event.clientY
              );
            }}
            onMouseDown={event => {
              const shouldStartPan =
                event.button === 1 || (event.button === 0 && event.shiftKey);
              if (!shouldStartPan || !graphOuterRef.current) {
                return;
              }
              event.preventDefault();
              panStateRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                startScrollLeft: graphOuterRef.current.scrollLeft,
                startScrollTop: graphOuterRef.current.scrollTop,
              };
            }}
          >
            <div
              style={{
                ...styles.graphStage,
                width: SHADER_GRAPH_CANVAS_WIDTH * graphZoom,
                height: SHADER_GRAPH_CANVAS_HEIGHT * graphZoom,
              }}
            >
              <div
                ref={graphInnerRef}
                style={{
                  ...styles.graphInner,
                  transform: `scale(${graphZoom})`,
                }}
                onMouseMove={event => {
                  if (!pendingConnectionRef.current) {
                    return;
                  }
                  lastMousePositionRef.current = {
                    clientX: event.clientX,
                    clientY: event.clientY,
                  };
                  syncInteractionFrame();
                }}
              >
                <div style={styles.graphGlow} />
                <svg style={styles.svgOverlay}>
                  <defs>
                    <filter id="shader-graph-connection-glow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="3.2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    {shaderGraphPortTypes.map(type => (
                      <marker
                        key={`marker-${type}`}
                        id={`shader-graph-arrow-${type}`}
                        markerWidth="9"
                        markerHeight="9"
                        refX="8"
                        refY="4.5"
                        orient="auto"
                      >
                        <path
                          d="M 0 0 L 9 4.5 L 0 9 z"
                          fill={getShaderGraphPortColor(type)}
                          opacity="0.92"
                        />
                      </marker>
                    ))}
                  </defs>
                  {graph.connections.map(connection => {
                    const fromNode = getNodeById(graph, connection.fromNodeId);
                    const toNode = getNodeById(graph, connection.toNodeId);
                    if (!fromNode || !toNode) {
                      return null;
                    }
                    const sourcePort = getShaderGraphNodeDefinition(
                      fromNode.type
                    ).outputs.find(port => port.id === connection.fromPortId);
                    const from = getNodePortPosition(
                      fromNode,
                      connection.fromPortId,
                      'output'
                    );
                    const to = getNodePortPosition(
                      toNode,
                      connection.toPortId,
                      'input'
                    );
                    const path = getBezierPath(from, to);
                    const strokeColor = getShaderGraphPortColor(
                      sourcePort ? sourcePort.type : 'vec4'
                    );
                    const connectionKey = `${connection.fromNodeId}-${connection.fromPortId}-${connection.toNodeId}-${connection.toPortId}`;
                    return (
                      <g key={connectionKey}>
                        <path
                          d={path}
                          stroke={strokeColor}
                          strokeWidth="7"
                          fill="none"
                          opacity="0.2"
                          filter="url(#shader-graph-connection-glow)"
                        />
                        <path
                          d={path}
                          stroke={strokeColor}
                          strokeWidth="2.4"
                          fill="none"
                          opacity="0.95"
                          markerEnd={`url(#shader-graph-arrow-${
                            sourcePort ? sourcePort.type : 'vec4'
                          })`}
                        />
                      </g>
                    );
                  })}
                  {pendingConnection &&
                    (() => {
                      const sourceNode = getNodeById(
                        graph,
                        pendingConnection.fromNodeId
                      );
                      if (!sourceNode) {
                        return null;
                      }
                      const sourcePort = getShaderGraphNodeDefinition(
                        sourceNode.type
                      ).outputs.find(
                        port => port.id === pendingConnection.fromPortId
                      );
                      const from = getNodePortPosition(
                        sourceNode,
                        pendingConnection.fromPortId,
                        'output'
                      );
                      return (
                        <g>
                          <path
                            d={getBezierPath(from, graphPointer)}
                            stroke={getShaderGraphPortColor(
                              sourcePort ? sourcePort.type : 'vec4'
                            )}
                            strokeWidth="5.5"
                            fill="none"
                            opacity="0.16"
                            filter="url(#shader-graph-connection-glow)"
                          />
                          <path
                            d={getBezierPath(from, graphPointer)}
                            stroke={getShaderGraphPortColor(
                              sourcePort ? sourcePort.type : 'vec4'
                            )}
                            strokeWidth="2.1"
                            strokeDasharray="7 6"
                            fill="none"
                            opacity="0.9"
                          />
                        </g>
                      );
                    })()}
                </svg>
                {graph.nodes.map(node => {
                  const definition = getShaderGraphNodeDefinition(node.type);
                  const rowCount = Math.max(
                    definition.inputs.length,
                    definition.outputs.length,
                    1
                  );
                  const summary = getShaderGraphNodeSummary(node);
                  return (
                    <div
                      key={node.id}
                      style={{
                        ...styles.nodeCard,
                        left: node.x,
                        top: node.y,
                        height: getShaderGraphNodeHeight(node),
                        borderColor:
                          node.id === selectedNodeId
                            ? definition.color
                            : 'rgba(176, 198, 238, 0.24)',
                        boxShadow:
                          node.id === selectedNodeId
                            ? `0 18px 30px rgba(0, 0, 0, 0.34), 0 0 0 1px ${definition.color}`
                            : styles.nodeCard.boxShadow,
                      }}
                      onClick={event => {
                        event.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                    >
                      <div
                        style={{
                          ...styles.nodeHeader,
                          background: `linear-gradient(90deg, ${definition.color}, rgba(255,255,255,0.08))`,
                        }}
                        onMouseDown={event => {
                          event.stopPropagation();
                          dragStateRef.current = {
                            nodeId: node.id,
                            startX: event.clientX,
                            startY: event.clientY,
                            originX: node.x,
                            originY: node.y,
                          };
                        }}
                      >
                        <span>{definition.title}</span>
                        <span style={{ fontSize: 11, opacity: 0.85 }}>
                          {definition.category}
                        </span>
                      </div>
                      <div style={styles.nodeBody}>
                        {Array.from({ length: rowCount }).map((_, rowIndex) => {
                          const inputPort = definition.inputs[rowIndex];
                          const outputPort = definition.outputs[rowIndex];
                          return (
                            <div key={rowIndex} style={styles.nodeRow}>
                              <div
                                style={styles.port}
                                onClick={event => {
                                  event.stopPropagation();
                                  if (inputPort) {
                                    handleInputClick(node.id, inputPort.id);
                                  }
                                }}
                              >
                                {inputPort ? (
                                  <React.Fragment>
                                    <span
                                      style={{
                                        ...styles.portDot,
                                        background: getShaderGraphPortColor(
                                          inputPort.type
                                        ),
                                      }}
                                    />
                                    <span>{inputPort.label}</span>
                                  </React.Fragment>
                                ) : (
                                  <span />
                                )}
                              </div>
                              <div
                                style={styles.port}
                                onClick={event => {
                                  event.stopPropagation();
                                  if (outputPort) {
                                    handleStartConnection(node.id, outputPort.id);
                                  }
                                }}
                              >
                                {outputPort ? (
                                  <React.Fragment>
                                    <span>{outputPort.label}</span>
                                    <span
                                      style={{
                                        ...styles.portDot,
                                        background: getShaderGraphPortColor(
                                          outputPort.type
                                        ),
                                      }}
                                    />
                                  </React.Fragment>
                                ) : (
                                  <span />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {summary && <div style={styles.nodeFooter}>{summary}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    [
      adjustGraphZoom,
      focusNodeInGraph,
      graph,
      graphZoom,
      graphPointer,
      handleInputClick,
      handleStartConnection,
      handleTemplateApply,
      pendingConnection,
      quickNodeResults,
      quickSearch,
      selectedNodeId,
      setQuickSearch,
      syncInteractionFrame,
      zoomGraphAtClientPoint,
    ]
  );

  const renderPreviewPanel = React.useCallback(
    () => (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <Text size="block-title">
            <Trans>Main Preview</Trans>
          </Text>
          <Text size="body2">
            <Trans>Live shader preview over a realistic lit scene texture.</Trans>
          </Text>
        </div>
        <div style={styles.panelBody}>
          <div style={styles.inspectorCard}>
            <label style={styles.fieldLabel}>
              <Trans>Blend Strength</Trans>
            </label>
            <input
              style={styles.slider}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={mixStrength}
              onChange={event => setMixStrength(parseFloat(event.target.value))}
            />
            <div
              style={{
                marginTop: 8,
                color: 'rgba(238, 243, 255, 0.78)',
                fontSize: 12,
              }}
            >
              {mixStrength.toFixed(2)}
            </div>
          </div>
          {!shaderValidation.isValid && shaderValidation.log ? (
            <div style={styles.compileLog}>{shaderValidation.log}</div>
          ) : null}
          <div style={{ height: 380 }}>
            <ShaderGraphPreview
              fragmentShader={effectivePreviewShader}
              mixStrength={mixStrength}
              animate={!!generatedProgram.usesTime}
              previewMode={previewMode}
            />
          </div>
        </div>
      </div>
    ),
    [
      effectivePreviewShader,
      generatedProgram.usesTime,
      mixStrength,
      previewMode,
      shaderValidation.isValid,
      shaderValidation.log,
    ]
  );

  const renderInspectorPanel = React.useCallback(
    () => (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <Text size="block-title">
            <Trans>Graph Inspector</Trans>
          </Text>
          <Text size="body2">
            <Trans>
              Edit node properties, exposed defaults, or remove a node.
            </Trans>
          </Text>
        </div>
        <div style={styles.panelBody}>
          <div style={styles.inspectorCard}>
            <Text size="block-title">
              <Trans>Project Stats</Trans>
            </Text>
            <div style={styles.infoChip}>{graph.nodes.length} nodes</div>
            <div style={styles.infoChip}>
              {graph.connections.length} connections
            </div>
            <div style={styles.infoChip}>
              {shaderValidation.isValid ? 'GLSL OK' : 'Compile issues'}
            </div>
          </div>

          {selectedNode ? (
            <div style={styles.inspectorCard}>
              <Text size="block-title">
                {getShaderGraphNodeDefinition(selectedNode.type).title}
              </Text>
              <Text size="body2">
                {getShaderGraphNodeDefinition(selectedNode.type).description}
              </Text>
              {(getShaderGraphNodeDefinition(selectedNode.type).controls || []).map(
                control => (
                  <div key={control.id} style={{ marginTop: 14 }}>
                    <label style={styles.fieldLabel}>{control.label}</label>
                    {control.type === 'color' ? (
                      <input
                        type="color"
                        value={
                          selectedNode.data &&
                          selectedNode.data[control.id] !== undefined
                            ? selectedNode.data[control.id]
                            : control.defaultValue
                        }
                        onChange={event =>
                          setGraph(previousGraph =>
                            updateNodeData(
                              previousGraph,
                              selectedNode.id,
                              control.id,
                              event.target.value
                            )
                          )
                        }
                      />
                    ) : (
                      <React.Fragment>
                        {control.min !== undefined &&
                          control.max !== undefined && (
                            <input
                              style={styles.slider}
                              type="range"
                              min={control.min}
                              max={control.max}
                              step={control.step || 0.01}
                              value={
                                selectedNode.data &&
                                selectedNode.data[control.id] !== undefined
                                  ? selectedNode.data[control.id]
                                  : control.defaultValue
                              }
                              onChange={event =>
                                setGraph(previousGraph =>
                                  updateNodeData(
                                    previousGraph,
                                    selectedNode.id,
                                    control.id,
                                    parseFloat(event.target.value) || 0
                                  )
                                )
                              }
                            />
                          )}
                        <SemiControlledTextField
                          fullWidth
                          margin="dense"
                          value={`${
                            selectedNode.data &&
                            selectedNode.data[control.id] !== undefined
                              ? selectedNode.data[control.id]
                              : control.defaultValue
                          }`}
                          onChange={value =>
                            setGraph(previousGraph =>
                              updateNodeData(
                                previousGraph,
                                selectedNode.id,
                                control.id,
                                parseFloat(value) || 0
                              )
                            )
                          }
                        />
                      </React.Fragment>
                    )}
                  </div>
                )
              )}
              {selectedNode.type !== 'output' && (
                <div style={{ marginTop: 18 }}>
                  <FlatButton
                    label={<Trans>Delete Node</Trans>}
                    onClick={() => {
                      setGraph(previousGraph =>
                        removeNodeFromGraph(previousGraph, selectedNode.id)
                      );
                      const outputNode = graph.nodes.find(
                        node =>
                          node.type === 'output' && node.id !== selectedNode.id
                      );
                      if (outputNode) {
                        setSelectedNodeId(outputNode.id);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <AlertMessage kind="info">
              <Trans>Select a node to edit its properties.</Trans>
            </AlertMessage>
          )}

          {graphDiagnostics.length > 0 &&
            graphDiagnostics.map((diagnostic, index) => (
              <AlertMessage
                key={`${diagnostic.message}-${index}`}
                kind={diagnostic.severity === 'error' ? 'error' : 'warning'}
              >
                {diagnostic.message}
              </AlertMessage>
            ))}
        </div>
      </div>
    ),
    [graph.connections.length, graph.nodes, graphDiagnostics, selectedNode, shaderValidation.isValid]
  );

  const renderCodePanel = React.useCallback(
    () => (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <div style={styles.graphToolbar}>
            <Text size="block-title">
              <Trans>Generated GLSL</Trans>
            </Text>
            <FlatButton
              label={<Trans>Copy GLSL</Trans>}
              onClick={copyShaderToClipboard}
            />
          </div>
          <Text size="body2">
            <Trans>
              Read-only fragment shader generated from the current graph.
            </Trans>
          </Text>
        </div>
        <div style={styles.panelBody}>
          {!shaderValidation.isValid && shaderValidation.log ? (
            <div style={styles.compileLog}>{shaderValidation.log}</div>
          ) : null}
          <div style={styles.codeBox}>{generatedProgram.fragmentShader}</div>
        </div>
      </div>
    ),
    [
      copyShaderToClipboard,
      generatedProgram.fragmentShader,
      shaderValidation.isValid,
      shaderValidation.log,
    ]
  );

  const editors = React.useMemo(
    () => ({
      palette: {
        type: 'secondary',
        title: t`Palette`,
        noTitleBar: true,
        renderEditor: renderPalettePanel,
      },
      graph: {
        type: 'primary',
        title: t`Graph`,
        noTitleBar: true,
        renderEditor: renderGraphPanel,
      },
      preview: {
        type: 'secondary',
        title: t`Main Preview`,
        noTitleBar: true,
        renderEditor: renderPreviewPanel,
      },
      inspector: {
        type: 'secondary',
        title: t`Inspector`,
        noTitleBar: true,
        renderEditor: renderInspectorPanel,
      },
      code: {
        type: 'secondary',
        title: t`Generated Code`,
        noTitleBar: true,
        renderEditor: renderCodePanel,
      },
    }),
    [
      renderCodePanel,
      renderGraphPanel,
      renderInspectorPanel,
      renderPalettePanel,
      renderPreviewPanel,
    ]
  );

  return (
    <Dialog
      title={<Trans>Shader Graph: {effect.getName()}</Trans>}
      open
      maxWidth={false}
      fullHeight
      noPadding
      fullscreen="always-even-on-desktop"
      onRequestClose={onClose}
      onApply={handleApply}
      actions={[
        <FlatButton
          key="close"
          label={<Trans>Close</Trans>}
          onClick={onClose}
        />,
        <DialogPrimaryButton
          key="apply"
          label={<Trans>Apply Shader Graph</Trans>}
          onClick={handleApply}
          primary
          disabled={!canApply}
        />,
      ]}
    >
      <div
        style={{
          ...styles.workspace,
          backgroundColor: gdevelopTheme.dialogBackgroundColor || '#0b1020',
        }}
      >
        <EditorMosaic
          // $FlowFixMe[incompatible-type]
          editors={editors}
          centralNodeId="graph"
          initialNodes={{
            direction: 'row',
            splitPercentage: 20,
            first: 'palette',
            second: {
              direction: 'row',
              splitPercentage: 74,
              first: {
                direction: 'column',
                splitPercentage: 78,
                first: 'graph',
                second: 'code',
              },
              second: {
                direction: 'column',
                splitPercentage: 55,
                first: 'preview',
                second: 'inspector',
              },
            },
          }}
        />
      </div>
    </Dialog>
  );
}
