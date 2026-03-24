/*
 * GDevelop JS Platform
 * Copyright 2013-2026 Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  const logger = new gdjs.Logger('Multithreading');
  const workerProtocol = 'gdjs.multithreading.v2';

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerRole = 'generic' | 'physics' | 'loader';

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerTaskPriority = 'high' | 'normal' | 'low';

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerMessageLogLevel = 'off' | 'errors' | 'verbose';

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerTaskHandlerContext = {
    jobId: string;
    handlerName: string;
    isWorkerThread: boolean;
  };

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerTaskHandler = (
    payload: unknown,
    context: WorkerTaskHandlerContext
  ) => unknown | Promise<unknown>;

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerTaskStatus =
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerTaskOptions = {
    transferables?: Transferable[];
    timeoutMs?: integer;
    preferMainThread?: boolean;
    allowMainThreadFallback?: boolean;
    workerRole?: WorkerRole;
    priority?: WorkerTaskPriority;
  };

  /**
   * @category Core Engine > Multithreading
   */
  export type MultithreadManagerOptions = {
    enabled?: boolean;
    workerCount?: integer;
    allowMainThreadFallback?: boolean;
    debugMessageLogLevel?: WorkerMessageLogLevel;
    physicsWorkerCount?: integer;
    loaderWorkerCount?: integer;
  };

  /**
   * @category Core Engine > Multithreading
   */
  export type MultithreadStats = {
    configuredWorkerCount: integer;
    activeWorkerCount: integer;
    busyWorkerCount: integer;
    queuedJobCount: integer;
    runningJobCount: integer;
    completedJobCount: integer;
    failedJobCount: integer;
    cancelledJobCount: integer;
    supportsWorkers: boolean;
    isUsingWorkers: boolean;
    registeredHandlerCount: integer;
    activeWorkerCountByRole: { [role in WorkerRole]: integer };
    queuedJobCountByRole: { [role in WorkerRole]: integer };
    runningJobCountByRole: { [role in WorkerRole]: integer };
  };

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerTaskQueueOptions = {
    name?: string;
    maxConcurrentTasks?: integer;
    autoStart?: boolean;
    workerRole?: WorkerRole;
    priority?: WorkerTaskPriority;
    allowMainThreadFallback?: boolean;
  };

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerTaskQueueStats = {
    name: string;
    isPaused: boolean;
    maxConcurrentTasks: integer;
    pendingTaskCount: integer;
    runningTaskCount: integer;
    completedTaskCount: integer;
    failedTaskCount: integer;
    cancelledTaskCount: integer;
  };

  /**
   * @category Core Engine > Multithreading
   */
  export type WorkerQueuedTask<T = unknown> = {
    id: string;
    promise: Promise<T>;
    cancel: () => boolean;
    getStatus: () => WorkerTaskStatus;
  };

  /**
   * @category Core Engine > Multithreading
   */
  export type TransferableWorkerTaskResult<T = unknown> = {
    __gdjsTransferableWorkerTaskResult: true;
    value: T;
    transferables: Transferable[];
  };

  type WorkerTaskHandlerDescriptor = {
    handler: WorkerTaskHandler;
    source: string;
    version: integer;
  };

  type WorkerSlot = {
    index: integer;
    role: WorkerRole;
    worker: Worker;
    busy: boolean;
    currentJobId: string | null;
    knownHandlerVersions: Map<string, integer>;
  };

  type WorkerThreadMessageRoute = 'job' | 'system';

  type WorkerThreadMessageType =
    | 'job.run'
    | 'job.completed'
    | 'job.failed'
    | 'system.error';

  type WorkerThreadMessageEnvelope = {
    protocol: string;
    route: WorkerThreadMessageRoute;
    messageType: WorkerThreadMessageType;
    jobId?: string;
    payload?: unknown;
    sentAt?: number;
  };

  type WorkerJob = {
    id: string;
    handlerName: string;
    handlerVersion: integer;
    handlerSource: string;
    handler: WorkerTaskHandler;
    payload: unknown;
    transferables: Transferable[];
    timeoutMs: integer | null;
    allowMainThreadFallback: boolean;
    preferMainThread: boolean;
    workerRole: WorkerRole;
    priority: WorkerTaskPriority;
    enqueueOrder: integer;
    handle: WorkerTaskHandle<unknown>;
    timeoutId: number | null;
    slotIndex: integer | null;
    isRunningOnMainThread: boolean;
  };

  type WorkerTaskQueueEntry = {
    id: string;
    handlerName: string;
    payload: unknown;
    options?: WorkerTaskOptions;
    status: WorkerTaskStatus;
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    runningHandle: WorkerTaskHandle<unknown> | null;
    cancellationError: gdjs.WorkerTaskCancelledError;
  };

  const workerTaskHandlers = new Map<string, WorkerTaskHandlerDescriptor>();

  const getDefaultWorkerCount = (): integer => {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency > 1
    ) {
      return Math.max(1, Math.min(8, navigator.hardwareConcurrency - 1));
    }

    return 1;
  };

  const normalizeWorkerCount = (workerCount: integer | undefined): integer => {
    if (typeof workerCount !== 'number' || !isFinite(workerCount)) {
      return getDefaultWorkerCount();
    }

    return Math.max(1, Math.floor(workerCount));
  };

  const normalizeError = (error: unknown): Error => {
    if (error instanceof Error) {
      return error;
    }

    const runtimeError = new Error(String(error));
    runtimeError.name = 'Error';
    return runtimeError;
  };

  const createWorkerError = (errorData: unknown): Error => {
    const errorAsRecord =
      errorData && typeof errorData === 'object'
        ? (errorData as {
            message?: unknown;
            name?: unknown;
            stack?: unknown;
          })
        : null;
    const error = new Error(
      errorAsRecord && typeof errorAsRecord.message === 'string'
        ? errorAsRecord.message
        : 'Worker task failed.'
    );
    error.name =
      errorAsRecord && typeof errorAsRecord.name === 'string'
        ? errorAsRecord.name
        : 'WorkerTaskError';
    if (errorAsRecord && typeof errorAsRecord.stack === 'string') {
      error.stack = errorAsRecord.stack;
    }
    return error;
  };

  const createCountByRole = (): { [role in WorkerRole]: integer } => ({
    generic: 0,
    physics: 0,
    loader: 0,
  });

  const incrementCountByRole = (
    countByRole: { [role in WorkerRole]: integer },
    role: WorkerRole
  ): void => {
    countByRole[role]++;
  };

  const getNow = (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  const normalizePriority = (
    priority: WorkerTaskPriority | undefined
  ): WorkerTaskPriority => {
    if (priority === 'high' || priority === 'low') {
      return priority;
    }
    return 'normal';
  };

  const getPriorityWeight = (priority: WorkerTaskPriority): integer => {
    switch (priority) {
      case 'high':
        return 2;
      case 'low':
        return 0;
      case 'normal':
      default:
        return 1;
    }
  };

  const normalizeWorkerRole = (
    role: WorkerRole | undefined | null
  ): WorkerRole => {
    switch (role) {
      case 'physics':
      case 'loader':
      case 'generic':
        return role;
      default:
        return 'generic';
    }
  };

  const normalizeWorkerMessageLogLevel = (
    logLevel: WorkerMessageLogLevel | undefined
  ): WorkerMessageLogLevel => {
    if (logLevel === 'off' || logLevel === 'verbose') {
      return logLevel;
    }
    return 'errors';
  };

  const normalizeDedicatedWorkerCount = (
    requestedCount: integer | undefined,
    fallbackCount: integer
  ): integer => {
    if (typeof requestedCount !== 'number' || !isFinite(requestedCount)) {
      return fallbackCount;
    }
    return Math.max(0, Math.floor(requestedCount));
  };

  const normalizeMaxConcurrentTasks = (
    maxConcurrentTasks: integer | undefined
  ): integer => {
    if (typeof maxConcurrentTasks !== 'number' || !isFinite(maxConcurrentTasks)) {
      return 4;
    }

    return Math.max(1, Math.floor(maxConcurrentTasks));
  };

  const createWorkerRolePlan = (
    configuredWorkerCount: integer,
    physicsWorkerCountOption: integer | undefined,
    loaderWorkerCountOption: integer | undefined
  ): WorkerRole[] => {
    const totalWorkerCount = Math.max(1, configuredWorkerCount);
    const defaultPhysicsWorkerCount = totalWorkerCount >= 2 ? 1 : 0;
    const defaultLoaderWorkerCount = totalWorkerCount >= 2 ? 1 : 0;

    let physicsWorkerCount = normalizeDedicatedWorkerCount(
      physicsWorkerCountOption,
      defaultPhysicsWorkerCount
    );
    let loaderWorkerCount = normalizeDedicatedWorkerCount(
      loaderWorkerCountOption,
      defaultLoaderWorkerCount
    );

    if (physicsWorkerCount + loaderWorkerCount > totalWorkerCount) {
      const overflow = physicsWorkerCount + loaderWorkerCount - totalWorkerCount;
      if (loaderWorkerCount >= overflow) {
        loaderWorkerCount -= overflow;
      } else {
        const remainingOverflow = overflow - loaderWorkerCount;
        loaderWorkerCount = 0;
        physicsWorkerCount = Math.max(0, physicsWorkerCount - remainingOverflow);
      }
    }

    const genericWorkerCount = Math.max(
      0,
      totalWorkerCount - physicsWorkerCount - loaderWorkerCount
    );
    const workerRoles: WorkerRole[] = [];

    for (let i = 0; i < physicsWorkerCount; i++) {
      workerRoles.push('physics');
    }
    for (let i = 0; i < loaderWorkerCount; i++) {
      workerRoles.push('loader');
    }
    for (let i = 0; i < genericWorkerCount; i++) {
      workerRoles.push('generic');
    }

    if (workerRoles.length === 0) {
      workerRoles.push('generic');
    }

    return workerRoles;
  };

  const isTransferableWorkerTaskResult = (
    value: unknown
  ): value is TransferableWorkerTaskResult<unknown> => {
    const maybeTransferableResult =
      value && typeof value === 'object'
        ? (value as {
            __gdjsTransferableWorkerTaskResult?: unknown;
            transferables?: unknown;
          })
        : null;
    return (
      !!maybeTransferableResult &&
      maybeTransferableResult.__gdjsTransferableWorkerTaskResult === true &&
      Array.isArray(maybeTransferableResult.transferables)
    );
  };

  const deduplicateTransferables = (
    transferables: Transferable[]
  ): Transferable[] => {
    const seenTransferables = new Set<Transferable>();
    const uniqueTransferables: Transferable[] = [];

    for (const transferable of transferables) {
      if (seenTransferables.has(transferable)) {
        continue;
      }
      seenTransferables.add(transferable);
      uniqueTransferables.push(transferable);
    }
    return uniqueTransferables;
  };

  const unwrapTransferableWorkerTaskResult = (value: unknown): unknown => {
    if (!isTransferableWorkerTaskResult(value)) {
      return value;
    }

    return value.value;
  };

  /**
   * Create a worker result with explicit transferables to avoid structured
   * clone copies for large payloads.
   * @category Core Engine > Multithreading
   */
  export const createTransferableWorkerTaskResult = <T>(
    value: T,
    transferables: Transferable[]
  ): TransferableWorkerTaskResult<T> => ({
    __gdjsTransferableWorkerTaskResult: true,
    value,
    transferables: deduplicateTransferables(transferables),
  });

  const isWorkerEnvelope = (
    payload: unknown
  ): payload is WorkerThreadMessageEnvelope => {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const envelope = payload as {
      protocol?: unknown;
      route?: unknown;
      messageType?: unknown;
    };

    return (
      envelope.protocol === workerProtocol &&
      (envelope.route === 'job' || envelope.route === 'system') &&
      typeof envelope.messageType === 'string'
    );
  };

  const createWorkerBootstrapSource = (): string => `
const workerProtocol = '${workerProtocol}';
const handlers = new Map();

const normalizeError = (error) => {
  if (error && typeof error === 'object') {
    return {
      name: typeof error.name === 'string' ? error.name : 'Error',
      message:
        typeof error.message === 'string' ? error.message : String(error),
      stack: typeof error.stack === 'string' ? error.stack : '',
    };
  }

  return {
    name: 'Error',
    message: String(error),
    stack: '',
  };
};

const compileHandler = (source) => (0, eval)('(' + source + ')');

const isTransferableWorkerTaskResult = (value) => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    value.__gdjsTransferableWorkerTaskResult === true &&
    Array.isArray(value.transferables)
  );
};

const deduplicateTransferables = (transferables) => {
  const seenTransferables = new Set();
  const uniqueTransferables = [];
  for (const transferable of transferables) {
    if (seenTransferables.has(transferable)) {
      continue;
    }
    seenTransferables.add(transferable);
    uniqueTransferables.push(transferable);
  }
  return uniqueTransferables;
};

const normalizeTransferableResult = (result) => {
  if (isTransferableWorkerTaskResult(result)) {
    return {
      value: result.value,
      transferables: deduplicateTransferables(result.transferables),
    };
  }

  return {
    value: result,
    transferables: [],
  };
};

const postEnvelope = (route, messageType, jobId, payload, transferables) => {
  const envelope = {
    protocol: workerProtocol,
    route,
    messageType,
    jobId,
    payload,
    sentAt:
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now(),
  };

  if (Array.isArray(transferables) && transferables.length > 0) {
    self.postMessage(envelope, transferables);
    return;
  }
  self.postMessage(envelope);
};

self.onmessage = async (event) => {
  const envelope = event ? event.data : null;
  if (!envelope || typeof envelope !== 'object') {
    return;
  }
  if (
    envelope.protocol !== workerProtocol ||
    envelope.route !== 'job' ||
    envelope.messageType !== 'job.run'
  ) {
    return;
  }

  const jobPayload =
    envelope.payload && typeof envelope.payload === 'object'
      ? envelope.payload
      : null;
  if (!jobPayload || typeof envelope.jobId !== 'string') {
    postEnvelope('system', 'system.error', undefined, {
      message: 'Invalid worker job envelope.',
    });
    return;
  }

  const {
    handlerName,
    handlerVersion,
    handlerSource,
    payload,
  } = jobPayload;
  if (typeof handlerName !== 'string' || typeof handlerVersion !== 'number') {
    postEnvelope('job', 'job.failed', envelope.jobId, {
      error: normalizeError(new Error('Invalid worker job payload.')),
    });
    return;
  }

  try {
    const cachedHandlerEntry = handlers.get(handlerName);
    let handler =
      cachedHandlerEntry && cachedHandlerEntry.version === handlerVersion
        ? cachedHandlerEntry.handler
        : null;

    if (!handler) {
      if (typeof handlerSource !== 'string') {
        throw new Error(
          'Worker task handler "' +
            handlerName +
            '" is missing from the worker cache.'
        );
      }

      handler = compileHandler(handlerSource);
      handlers.set(handlerName, {
        version: handlerVersion,
        handler,
      });
    }

    const result = await handler(payload, {
      jobId: envelope.jobId,
      handlerName,
      isWorkerThread: true,
    });
    const normalizedResult = normalizeTransferableResult(result);

    postEnvelope(
      'job',
      'job.completed',
      envelope.jobId,
      {
        result: normalizedResult.value,
      },
      normalizedResult.transferables
    );
  } catch (error) {
    postEnvelope('job', 'job.failed', envelope.jobId, {
      error: normalizeError(error),
    });
  }
};
`;

  /**
   * Error used when a multithreaded task is cancelled.
   * @category Core Engine > Multithreading
   */
  export class WorkerTaskCancelledError extends Error {
    constructor(message = 'The worker task was cancelled.') {
      super(message);
      this.name = 'WorkerTaskCancelledError';
    }
  }

  /**
   * Error used when a multithreaded task exceeds its timeout.
   * @category Core Engine > Multithreading
   */
  export class WorkerTaskTimeoutError extends Error {
    constructor(message = 'The worker task timed out.') {
      super(message);
      this.name = 'WorkerTaskTimeoutError';
    }
  }

  /**
   * Register a self-contained handler that can be executed on worker threads.
   * The handler should only use serializable input/output and must not depend
   * on variables captured from a surrounding closure.
   * @category Core Engine > Multithreading
   */
  export const registerWorkerTaskHandler = (
    handlerName: string,
    handler: WorkerTaskHandler
  ): void => {
    const normalizedHandlerName = handlerName.trim();
    if (!normalizedHandlerName) {
      throw new Error('Worker task handlers must have a non-empty name.');
    }

    const handlerSource = handler.toString();
    if (!handlerSource || handlerSource.includes('[native code]')) {
      throw new Error(
        'Worker task handlers must be declared in JavaScript and serializable.'
      );
    }

    const currentDescriptor = workerTaskHandlers.get(normalizedHandlerName);
    workerTaskHandlers.set(normalizedHandlerName, {
      handler,
      source: handlerSource,
      version: currentDescriptor ? currentDescriptor.version + 1 : 1,
    });
  };

  /**
   * Unregister a previously registered worker task handler.
   * @category Core Engine > Multithreading
   */
  export const unregisterWorkerTaskHandler = (
    handlerName: string
  ): boolean => workerTaskHandlers.delete(handlerName);

  /**
   * Return true if a worker task handler exists.
   * @category Core Engine > Multithreading
   */
  export const hasWorkerTaskHandler = (handlerName: string): boolean =>
    workerTaskHandlers.has(handlerName);

  /**
   * Represents a submitted task that runs on the worker pool or on the
   * main thread fallback.
   * @category Core Engine > Multithreading
   */
  export class WorkerTaskHandle<T = unknown> {
    readonly id: string;
    readonly promise: Promise<T>;
    private _manager: MultithreadManager | null;
    private _status: WorkerTaskStatus = 'queued';
    private _result: T | null = null;
    private _error: unknown = null;
    private _resolve!: (value: T) => void;
    private _reject!: (reason: unknown) => void;

    constructor(manager: MultithreadManager, id: string) {
      this.id = id;
      this._manager = manager;
      this.promise = new Promise<T>((resolve, reject) => {
        this._resolve = resolve;
        this._reject = reject;
      });
    }

    cancel(): boolean {
      return this._manager ? this._manager.cancelTask(this.id) : false;
    }

    getStatus(): WorkerTaskStatus {
      return this._status;
    }

    isFinished(): boolean {
      return (
        this._status === 'completed' ||
        this._status === 'failed' ||
        this._status === 'cancelled'
      );
    }

    getResult(): T | null {
      return this._result;
    }

    getError(): unknown {
      return this._error;
    }

    /** @internal */
    _markRunning(): void {
      if (this.isFinished()) {
        return;
      }
      this._status = 'running';
    }

    /** @internal */
    _markCompleted(result: T): void {
      if (this.isFinished()) {
        return;
      }
      this._status = 'completed';
      this._result = result;
      this._manager = null;
      this._resolve(result);
    }

    /** @internal */
    _markFailed(error: unknown): void {
      if (this.isFinished()) {
        return;
      }
      this._status =
        error instanceof gdjs.WorkerTaskCancelledError
          ? 'cancelled'
          : 'failed';
      this._error = error;
      this._manager = null;
      this._reject(error);
    }
  }

  /**
   * Async task wrapper that allows worker jobs to be consumed by the
   * existing scene async task manager.
   * @category Core Engine > Multithreading
   */
  export class WorkerTask<T = unknown> extends gdjs.AsyncTask {
    private _handle: WorkerTaskHandle<T>;
    private _isSettled = false;
    private _result: T | null = null;
    private _error: unknown = null;

    constructor(handle: WorkerTaskHandle<T>) {
      super();
      this._handle = handle;

      handle.promise.then(
        (result) => {
          this._isSettled = true;
          this._result = result;
        },
        (error) => {
          this._isSettled = true;
          this._error = error;
        }
      );
    }

    update(): boolean {
      return this._isSettled;
    }

    wasSuccessful(): boolean {
      return this._isSettled && this._error === null;
    }

    getResult(): T | null {
      return this._result;
    }

    getError(): unknown {
      return this._error;
    }

    getHandle(): WorkerTaskHandle<T> {
      return this._handle;
    }

    cancel(): boolean {
      return this._handle.cancel();
    }

    getNetworkSyncData(): AsyncTaskNetworkSyncData {
      return null;
    }

    updateFromNetworkSyncData(_syncData: AsyncTaskNetworkSyncData): void {}
  }

  /**
   * Lightweight FIFO queue for splitting heavy workloads into small worker jobs.
   * @category Core Engine > Multithreading
   */
  export class WorkerTaskQueue {
    private _manager: MultithreadManager;
    private _name: string;
    private _maxConcurrentTasks: integer;
    private _paused: boolean;
    private _disposed = false;
    private _defaultTaskOptions: WorkerTaskOptions;
    private _pendingEntries: WorkerTaskQueueEntry[] = [];
    private _runningEntries = new Map<string, WorkerTaskQueueEntry>();
    private _taskIndex = 0;
    private _completedTaskCount = 0;
    private _failedTaskCount = 0;
    private _cancelledTaskCount = 0;
    private _drainResolvers: Array<() => void> = [];

    constructor(
      manager: MultithreadManager,
      options?: WorkerTaskQueueOptions
    ) {
      this._manager = manager;
      this._name =
        options?.name && options.name.trim()
          ? options.name.trim()
          : 'worker-task-queue';
      this._maxConcurrentTasks = normalizeMaxConcurrentTasks(
        options?.maxConcurrentTasks
      );
      this._paused = options?.autoStart === false;

      this._defaultTaskOptions = {
        allowMainThreadFallback: options?.allowMainThreadFallback,
        workerRole: normalizeWorkerRole(options?.workerRole),
        priority: normalizePriority(options?.priority),
      };
    }

    private _mergeTaskOptions(
      options: WorkerTaskOptions | undefined
    ): WorkerTaskOptions {
      return {
        ...this._defaultTaskOptions,
        ...(options || {}),
      };
    }

    private _createTaskId(): string {
      this._taskIndex++;
      return this._name + '-task-' + this._taskIndex;
    }

    private _notifyIfDrained(): void {
      if (this._pendingEntries.length > 0 || this._runningEntries.size > 0) {
        return;
      }

      while (this._drainResolvers.length > 0) {
        const resolver = this._drainResolvers.shift();
        if (resolver) {
          resolver();
        }
      }
    }

    private _startEntry(entry: WorkerTaskQueueEntry): void {
      entry.status = 'running';
      const mergedOptions = this._mergeTaskOptions(entry.options);

      let taskHandle: WorkerTaskHandle<unknown>;
      try {
        taskHandle = this._manager.runTask(
          entry.handlerName,
          entry.payload,
          mergedOptions
        );
      } catch (error) {
        entry.status = 'failed';
        this._failedTaskCount++;
        entry.reject(error);
        this._notifyIfDrained();
        return;
      }

      entry.runningHandle = taskHandle;
      this._runningEntries.set(entry.id, entry);
      taskHandle.promise.then(
        (result) => {
          this._runningEntries.delete(entry.id);
          entry.runningHandle = null;

          if (entry.status === 'cancelled') {
            this._cancelledTaskCount++;
            entry.reject(entry.cancellationError);
          } else {
            entry.status = 'completed';
            this._completedTaskCount++;
            entry.resolve(result);
          }

          this._schedule();
          this._notifyIfDrained();
        },
        (error) => {
          this._runningEntries.delete(entry.id);
          entry.runningHandle = null;

          if (
            entry.status === 'cancelled' ||
            error instanceof gdjs.WorkerTaskCancelledError
          ) {
            entry.status = 'cancelled';
            this._cancelledTaskCount++;
          } else {
            entry.status = 'failed';
            this._failedTaskCount++;
          }
          entry.reject(error);

          this._schedule();
          this._notifyIfDrained();
        }
      );
    }

    private _schedule(): void {
      if (this._disposed || this._paused) {
        return;
      }

      while (
        this._pendingEntries.length > 0 &&
        this._runningEntries.size < this._maxConcurrentTasks
      ) {
        const nextEntry = this._pendingEntries.shift();
        if (!nextEntry) {
          continue;
        }
        this._startEntry(nextEntry);
      }
    }

    enqueue<T = unknown>(
      handlerName: string,
      payload: unknown,
      options?: WorkerTaskOptions
    ): WorkerQueuedTask<T> {
      if (this._disposed) {
        const queueDisposedError = new gdjs.WorkerTaskCancelledError(
          'The worker task queue "' + this._name + '" was disposed.'
        );
        return {
          id: this._createTaskId(),
          promise: Promise.reject(queueDisposedError),
          cancel: () => false,
          getStatus: () => 'cancelled',
        };
      }

      let resolve!: (value: unknown) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<unknown>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });

      const taskId = this._createTaskId();
      const entry: WorkerTaskQueueEntry = {
        id: taskId,
        handlerName,
        payload,
        options,
        status: 'queued',
        resolve,
        reject,
        runningHandle: null,
        cancellationError: new gdjs.WorkerTaskCancelledError(
          'The worker queued task "' + taskId + '" was cancelled.'
        ),
      };
      this._pendingEntries.push(entry);
      this._schedule();

      return {
        id: taskId,
        promise: promise as Promise<T>,
        cancel: () => this.cancelTask(taskId),
        getStatus: () => entry.status,
      };
    }

    enqueueBatch<T = unknown>(
      tasks: Array<{
        handlerName: string;
        payload: unknown;
        options?: WorkerTaskOptions;
      }>
    ): Array<WorkerQueuedTask<T>> {
      const queuedTasks: Array<WorkerQueuedTask<T>> = [];
      for (const task of tasks) {
        queuedTasks.push(
          this.enqueue<T>(task.handlerName, task.payload, task.options)
        );
      }
      return queuedTasks;
    }

    cancelTask(taskId: string): boolean {
      const pendingTaskIndex = this._pendingEntries.findIndex(
        (entry) => entry.id === taskId
      );
      if (pendingTaskIndex !== -1) {
        const [pendingEntry] = this._pendingEntries.splice(pendingTaskIndex, 1);
        pendingEntry.status = 'cancelled';
        this._cancelledTaskCount++;
        pendingEntry.reject(pendingEntry.cancellationError);
        this._notifyIfDrained();
        return true;
      }

      const runningEntry = this._runningEntries.get(taskId);
      if (!runningEntry || !runningEntry.runningHandle) {
        return false;
      }

      const previousStatus = runningEntry.status;
      runningEntry.status = 'cancelled';
      const isCancelled = runningEntry.runningHandle.cancel();
      if (!isCancelled) {
        runningEntry.status = previousStatus;
      }
      return isCancelled;
    }

    pause(): void {
      this._paused = true;
    }

    resume(): void {
      this._paused = false;
      this._schedule();
    }

    isPaused(): boolean {
      return this._paused;
    }

    clearPendingTasks(): integer {
      let clearedCount = 0;
      while (this._pendingEntries.length > 0) {
        const pendingEntry = this._pendingEntries.shift();
        if (!pendingEntry) {
          continue;
        }
        pendingEntry.status = 'cancelled';
        this._cancelledTaskCount++;
        pendingEntry.reject(pendingEntry.cancellationError);
        clearedCount++;
      }

      this._notifyIfDrained();
      return clearedCount;
    }

    async drain(): Promise<void> {
      if (this._pendingEntries.length === 0 && this._runningEntries.size === 0) {
        return;
      }

      return new Promise<void>((resolve) => {
        this._drainResolvers.push(resolve);
      });
    }

    getStats(): WorkerTaskQueueStats {
      return {
        name: this._name,
        isPaused: this._paused,
        maxConcurrentTasks: this._maxConcurrentTasks,
        pendingTaskCount: this._pendingEntries.length,
        runningTaskCount: this._runningEntries.size,
        completedTaskCount: this._completedTaskCount,
        failedTaskCount: this._failedTaskCount,
        cancelledTaskCount: this._cancelledTaskCount,
      };
    }

    dispose(): void {
      if (this._disposed) {
        return;
      }

      this._disposed = true;
      this._paused = true;
      this.clearPendingTasks();

      for (const runningEntry of this._runningEntries.values()) {
        if (!runningEntry.runningHandle) {
          continue;
        }
        runningEntry.status = 'cancelled';
        runningEntry.runningHandle.cancel();
      }

      this._notifyIfDrained();
    }
  }

  /**
   * Worker pool and queue used by the runtime to offload heavy serializable
   * computations outside of the main frame loop.
   * @category Core Engine > Multithreading
   */
  export class MultithreadManager {
    private _enabled: boolean;
    private _disposed = false;
    private _allowMainThreadFallback: boolean;
    private _configuredWorkerCount: integer;
    private _configuredWorkerRoles: WorkerRole[];
    private _debugMessageLogLevel: WorkerMessageLogLevel;
    private _supportsWorkers: boolean;
    private _workerScriptUrl: string | null = null;
    private _workerSlots: WorkerSlot[] = [];
    private _pendingJobs: WorkerJob[] = [];
    private _runningJobs = new Map<string, WorkerJob>();
    private _jobIndex = 0;
    private _enqueueOrder = 0;
    private _completedJobCount = 0;
    private _failedJobCount = 0;
    private _cancelledJobCount = 0;

    constructor(options?: MultithreadManagerOptions) {
      this._enabled = options?.enabled !== false;
      this._allowMainThreadFallback = options?.allowMainThreadFallback !== false;
      this._configuredWorkerCount = normalizeWorkerCount(options?.workerCount);
      this._configuredWorkerRoles = createWorkerRolePlan(
        this._configuredWorkerCount,
        options?.physicsWorkerCount,
        options?.loaderWorkerCount
      );
      this._configuredWorkerCount = this._configuredWorkerRoles.length;
      this._debugMessageLogLevel = normalizeWorkerMessageLogLevel(
        options?.debugMessageLogLevel
      );
      this._supportsWorkers = this._detectWorkerSupport();
    }

    private _detectWorkerSupport(): boolean {
      return (
        this._enabled &&
        typeof Worker !== 'undefined' &&
        typeof Blob !== 'undefined' &&
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function'
      );
    }

    private _throwIfDisposed(): void {
      if (this._disposed) {
        throw new Error('The multithread manager was already disposed.');
      }
    }

    private _logThreadMessage(
      direction: 'in' | 'out',
      workerSlot: WorkerSlot,
      envelope: WorkerThreadMessageEnvelope
    ): void {
      if (this._debugMessageLogLevel !== 'verbose') {
        return;
      }

      logger.info(
        '[Thread ' +
          direction.toUpperCase() +
          '] worker#' +
          workerSlot.index +
          ' role=' +
          workerSlot.role +
          ' route=' +
          envelope.route +
          ' type=' +
          envelope.messageType +
          (envelope.jobId ? ' job=' + envelope.jobId : '')
      );
    }

    private _logThreadError(message: string, details?: unknown): void {
      if (this._debugMessageLogLevel === 'off') {
        return;
      }

      if (details !== undefined) {
        logger.warn(message, details);
      } else {
        logger.warn(message);
      }
    }

    private _canUseWorkersForJob(job: WorkerJob): boolean {
      return this._supportsWorkers && !job.preferMainThread;
    }

    private _shouldUseMainThreadFallback(job: WorkerJob): boolean {
      return (
        job.preferMainThread ||
        (!this._canUseWorkersForJob(job) && job.allowMainThreadFallback)
      );
    }

    private _getWorkerCompatibilityWeight(
      workerSlot: WorkerSlot,
      job: WorkerJob
    ): integer {
      if (workerSlot.role === job.workerRole) {
        return 3;
      }
      if (workerSlot.role === 'generic') {
        return 2;
      }
      if (job.workerRole === 'generic') {
        return 1;
      }
      return 0;
    }

    private _findNextPendingJobIndexForWorkerSlot(
      workerSlot: WorkerSlot
    ): integer {
      let bestJobIndex = -1;
      let bestCompatibilityWeight = -1;
      let bestPriorityWeight = -1;
      let bestEnqueueOrder = Number.POSITIVE_INFINITY;

      for (let i = 0; i < this._pendingJobs.length; i++) {
        const pendingJob = this._pendingJobs[i];
        const compatibilityWeight = this._getWorkerCompatibilityWeight(
          workerSlot,
          pendingJob
        );
        if (compatibilityWeight <= 0) {
          continue;
        }

        const priorityWeight = getPriorityWeight(pendingJob.priority);
        if (
          priorityWeight > bestPriorityWeight ||
          (priorityWeight === bestPriorityWeight &&
            compatibilityWeight > bestCompatibilityWeight) ||
          (priorityWeight === bestPriorityWeight &&
            compatibilityWeight === bestCompatibilityWeight &&
            pendingJob.enqueueOrder < bestEnqueueOrder)
        ) {
          bestJobIndex = i;
          bestCompatibilityWeight = compatibilityWeight;
          bestPriorityWeight = priorityWeight;
          bestEnqueueOrder = pendingJob.enqueueOrder;
        }
      }

      return bestJobIndex;
    }

    private _createJobId(): string {
      this._jobIndex++;
      return 'worker-job-' + this._jobIndex;
    }

    private _getHandlerDescriptor(handlerName: string): WorkerTaskHandlerDescriptor {
      const descriptor = workerTaskHandlers.get(handlerName);
      if (!descriptor) {
        throw new Error(
          'No worker task handler is registered under "' + handlerName + '".'
        );
      }
      return descriptor;
    }

    private _ensureWorkerScriptUrl(): string {
      if (this._workerScriptUrl) {
        return this._workerScriptUrl;
      }

      const workerSource = createWorkerBootstrapSource();
      this._workerScriptUrl = URL.createObjectURL(
        new Blob([workerSource], { type: 'application/javascript' })
      );
      return this._workerScriptUrl;
    }

    private _createWorkerSlot(workerIndex: integer): WorkerSlot {
      const worker = new Worker(this._ensureWorkerScriptUrl());
      const workerSlot: WorkerSlot = {
        index: workerIndex,
        role: this._configuredWorkerRoles[workerIndex] || 'generic',
        worker,
        busy: false,
        currentJobId: null,
        knownHandlerVersions: new Map<string, integer>(),
      };

      worker.onmessage = (event: MessageEvent) => {
        const envelope = event ? event.data : null;
        if (!isWorkerEnvelope(envelope)) {
          this._logThreadError(
            'Worker sent an invalid message envelope. Replacing worker slot.',
            envelope
          );
          const currentJobId = workerSlot.currentJobId;
          workerSlot.busy = false;
          workerSlot.currentJobId = null;
          if (currentJobId) {
            this._failJob(
              currentJobId,
              new Error('A worker sent an invalid message envelope.')
            );
          }
          if (!this._disposed) {
            this._replaceWorkerSlot(workerIndex);
            this._schedulePendingJobs();
          }
          return;
        }

        this._logThreadMessage('in', workerSlot, envelope);

        if (envelope.route === 'system') {
          this._logThreadError(
            'Worker reported a system-level message.',
            envelope.payload
          );
          const runningJobId = workerSlot.currentJobId;
          workerSlot.busy = false;
          workerSlot.currentJobId = null;
          if (runningJobId) {
            this._failJob(
              runningJobId,
              new Error('Worker reported a system-level failure.')
            );
          }
          if (!this._disposed) {
            this._replaceWorkerSlot(workerIndex);
            this._schedulePendingJobs();
          }
          return;
        }

        if (typeof envelope.jobId !== 'string') {
          this._logThreadError(
            'Worker sent a job message without a valid job id.',
            envelope
          );
          const runningJobId = workerSlot.currentJobId;
          workerSlot.busy = false;
          workerSlot.currentJobId = null;
          if (runningJobId) {
            this._failJob(
              runningJobId,
              new Error('Worker sent a message without a valid job id.')
            );
          }
          if (!this._disposed) {
            this._replaceWorkerSlot(workerIndex);
            this._schedulePendingJobs();
          }
          return;
        }

        const runningJob = this._runningJobs.get(envelope.jobId);
        if (!runningJob) {
          return;
        }

        workerSlot.busy = false;
        workerSlot.currentJobId = null;

        const payload =
          envelope.payload && typeof envelope.payload === 'object'
            ? (envelope.payload as {
                result?: unknown;
                error?: unknown;
              })
            : null;

        if (envelope.messageType === 'job.completed') {
          this._completeJob(envelope.jobId, payload ? payload.result : undefined);
        } else if (envelope.messageType === 'job.failed') {
          this._failJob(
            envelope.jobId,
            createWorkerError(payload ? payload.error : null)
          );
        } else {
          this._failJob(
            envelope.jobId,
            new Error('Worker returned an unsupported job message type.')
          );
        }

        this._schedulePendingJobs();
      };

      worker.onerror = (event: ErrorEvent) => {
        this._logThreadError('Worker runtime error.', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
        const currentJobId = workerSlot.currentJobId;
        workerSlot.busy = false;
        workerSlot.currentJobId = null;
        if (currentJobId) {
          const error = new Error(
            event.message || 'The worker terminated with an error.'
          );
          error.name = 'WorkerRuntimeError';
          this._failJob(currentJobId, error);
        }
        if (!this._disposed) {
          this._replaceWorkerSlot(workerIndex);
          this._schedulePendingJobs();
        }
      };

      worker.onmessageerror = () => {
        this._logThreadError(
          'Worker message deserialization error in main thread message channel.'
        );
        const currentJobId = workerSlot.currentJobId;
        workerSlot.busy = false;
        workerSlot.currentJobId = null;
        if (currentJobId) {
          this._failJob(
            currentJobId,
            new Error('A worker sent data that could not be deserialized.')
          );
        }
        if (!this._disposed) {
          this._replaceWorkerSlot(workerIndex);
          this._schedulePendingJobs();
        }
      };

      return workerSlot;
    }

    private _replaceWorkerSlot(workerIndex: integer): void {
      const previousWorkerSlot = this._workerSlots[workerIndex];
      if (previousWorkerSlot) {
        previousWorkerSlot.worker.terminate();
      }

      if (!this._supportsWorkers || this._disposed) {
        return;
      }

      try {
        this._workerSlots[workerIndex] = this._createWorkerSlot(workerIndex);
      } catch (error) {
        logger.warn(
          'Falling back to the main thread after a worker recreation failure:',
          error
        );
        this._supportsWorkers = false;
        this._disposeWorkers();
      }
    }

    private _ensureWorkerPool(): boolean {
      if (!this._supportsWorkers) {
        return false;
      }

      try {
        while (this._workerSlots.length < this._configuredWorkerCount) {
          const workerIndex = this._workerSlots.length;
          this._workerSlots.push(this._createWorkerSlot(workerIndex));
        }
        return true;
      } catch (error) {
        logger.warn(
          'Falling back to the main thread because workers could not be created:',
          error
        );
        this._supportsWorkers = false;
        this._disposeWorkers();
        return false;
      }
    }

    private _disposeWorkers(): void {
      for (const workerSlot of this._workerSlots) {
        workerSlot.worker.terminate();
      }
      this._workerSlots.length = 0;
    }

    private _startTimeout(job: WorkerJob): void {
      if (job.timeoutMs === null || job.timeoutMs <= 0) {
        return;
      }

      job.timeoutId = window.setTimeout(() => {
        const timedOutJob = this._runningJobs.get(job.id);
        if (timedOutJob) {
          this._abortRunningJob(
            timedOutJob,
            new gdjs.WorkerTaskTimeoutError(
              'The worker task "' + job.handlerName + '" timed out.'
            )
          );
          return;
        }

        const pendingJobIndex = this._pendingJobs.findIndex(
          (pendingJob) => pendingJob.id === job.id
        );
        if (pendingJobIndex !== -1) {
          const [pendingJob] = this._pendingJobs.splice(pendingJobIndex, 1);
          this._clearTimeout(pendingJob);
          pendingJob.handle._markFailed(
            new gdjs.WorkerTaskTimeoutError(
              'The queued worker task "' + job.handlerName + '" timed out.'
            )
          );
          this._failedJobCount++;
        }
      }, job.timeoutMs);
    }

    private _clearTimeout(job: WorkerJob): void {
      if (job.timeoutId !== null) {
        clearTimeout(job.timeoutId);
        job.timeoutId = null;
      }
    }

    private _runJobOnMainThread(job: WorkerJob): void {
      job.isRunningOnMainThread = true;
      job.handle._markRunning();
      this._runningJobs.set(job.id, job);

      Promise.resolve()
        .then(() =>
          job.handler(job.payload, {
            jobId: job.id,
            handlerName: job.handlerName,
            isWorkerThread: false,
          })
        )
        .then(
          (result) => {
            if (!this._runningJobs.has(job.id)) {
              return;
            }
            this._completeJob(job.id, unwrapTransferableWorkerTaskResult(result));
          },
          (error) => {
            if (!this._runningJobs.has(job.id)) {
              return;
            }
            this._failJob(job.id, normalizeError(error));
          }
        );
    }

    private _dispatchJobToWorker(job: WorkerJob, workerIndex: integer): boolean {
      const workerSlot = this._workerSlots[workerIndex];
      const shouldSendHandlerSource =
        workerSlot.knownHandlerVersions.get(job.handlerName) !==
        job.handlerVersion;

      try {
        workerSlot.busy = true;
        workerSlot.currentJobId = job.id;
        job.slotIndex = workerIndex;
        job.handle._markRunning();
        this._runningJobs.set(job.id, job);

        const messageEnvelope: WorkerThreadMessageEnvelope = {
          protocol: workerProtocol,
          route: 'job',
          messageType: 'job.run',
          jobId: job.id,
          payload: {
            handlerName: job.handlerName,
            handlerVersion: job.handlerVersion,
            handlerSource: shouldSendHandlerSource
              ? job.handlerSource
              : undefined,
            payload: job.payload,
            workerRole: job.workerRole,
            priority: job.priority,
          },
          sentAt: getNow(),
        };
        this._logThreadMessage('out', workerSlot, messageEnvelope);
        workerSlot.worker.postMessage(
          messageEnvelope,
          deduplicateTransferables(job.transferables)
        );
        workerSlot.knownHandlerVersions.set(
          job.handlerName,
          job.handlerVersion
        );

        return true;
      } catch (error) {
        workerSlot.busy = false;
        workerSlot.currentJobId = null;
        job.slotIndex = null;

        if (job.allowMainThreadFallback) {
          this._runningJobs.delete(job.id);
          logger.warn(
            'Running worker task on the main thread after worker dispatch failure:',
            error
          );
          this._runJobOnMainThread(job);
          return true;
        }

        this._failJob(job.id, normalizeError(error));
        return false;
      }
    }

    private _schedulePendingJobs(): void {
      if (this._disposed || this._pendingJobs.length === 0) {
        return;
      }

      if (!this._ensureWorkerPool()) {
        if (!this._allowMainThreadFallback) {
          while (this._pendingJobs.length > 0) {
            const pendingJob = this._pendingJobs.shift();
            if (!pendingJob) {
              continue;
            }
            this._clearTimeout(pendingJob);
            pendingJob.handle._markFailed(
              new Error(
                'Worker tasks are unavailable and the main thread fallback is disabled.'
              )
            );
            this._failedJobCount++;
          }
          return;
        }

        while (this._pendingJobs.length > 0) {
          const pendingJob = this._pendingJobs.shift();
          if (!pendingJob) {
            continue;
          }
          this._runJobOnMainThread(pendingJob);
        }
        return;
      }

      for (let i = 0; i < this._workerSlots.length; ++i) {
        const workerSlot = this._workerSlots[i];
        if (workerSlot.busy) {
          continue;
        }

        const nextJobIndex = this._findNextPendingJobIndexForWorkerSlot(
          workerSlot
        );
        if (nextJobIndex === -1) {
          continue;
        }

        const [nextJob] = this._pendingJobs.splice(nextJobIndex, 1);
        if (!nextJob) {
          continue;
        }

        this._dispatchJobToWorker(nextJob, i);
      }
    }

    private _completeJob(jobId: string, result: unknown): void {
      const job = this._runningJobs.get(jobId);
      if (!job) {
        return;
      }

      this._runningJobs.delete(jobId);
      this._clearTimeout(job);
      job.handle._markCompleted(result);
      this._completedJobCount++;
    }

    private _failJob(jobId: string, error: unknown): void {
      const job = this._runningJobs.get(jobId);
      if (job) {
        this._runningJobs.delete(jobId);
        this._clearTimeout(job);
        job.handle._markFailed(error);
        this._failedJobCount++;
        return;
      }

      const pendingJobIndex = this._pendingJobs.findIndex(
        (pendingJob) => pendingJob.id === jobId
      );
      if (pendingJobIndex === -1) {
        return;
      }

      const [pendingJob] = this._pendingJobs.splice(pendingJobIndex, 1);
      this._clearTimeout(pendingJob);
      pendingJob.handle._markFailed(error);
      this._failedJobCount++;
    }

    private _abortRunningJob(job: WorkerJob, error: Error): void {
      this._runningJobs.delete(job.id);
      this._clearTimeout(job);
      job.handle._markFailed(error);

      if (job.slotIndex !== null && !job.isRunningOnMainThread) {
        this._replaceWorkerSlot(job.slotIndex);
      }

      if (error instanceof gdjs.WorkerTaskCancelledError) {
        this._cancelledJobCount++;
      } else {
        this._failedJobCount++;
      }
      this._schedulePendingJobs();
    }

    runTask<T = unknown>(
      handlerName: string,
      payload: unknown,
      options?: WorkerTaskOptions
    ): WorkerTaskHandle<T> {
      this._throwIfDisposed();

      const handlerDescriptor = this._getHandlerDescriptor(handlerName);
      const jobId = this._createJobId();
      const handle = new gdjs.WorkerTaskHandle<T>(this, jobId);
      const job: WorkerJob = {
        id: jobId,
        handlerName,
        handlerVersion: handlerDescriptor.version,
        handlerSource: handlerDescriptor.source,
        handler: handlerDescriptor.handler,
        payload,
        transferables: options?.transferables || [],
        timeoutMs:
          typeof options?.timeoutMs === 'number' && isFinite(options.timeoutMs)
            ? Math.max(1, Math.floor(options.timeoutMs))
            : null,
        allowMainThreadFallback:
          options?.allowMainThreadFallback !== undefined
            ? options.allowMainThreadFallback
            : this._allowMainThreadFallback,
        preferMainThread: options?.preferMainThread === true,
        workerRole: normalizeWorkerRole(options?.workerRole),
        priority: normalizePriority(options?.priority),
        enqueueOrder: this._enqueueOrder++,
        handle: handle as unknown as WorkerTaskHandle<unknown>,
        timeoutId: null,
        slotIndex: null,
        isRunningOnMainThread: false,
      };

      this._startTimeout(job);

      if (this._shouldUseMainThreadFallback(job)) {
        this._runJobOnMainThread(job);
      } else if (this._canUseWorkersForJob(job)) {
        this._pendingJobs.push(job);
        this._schedulePendingJobs();
      } else {
        job.handle._markFailed(
          new Error(
            'Worker tasks are unavailable and the main thread fallback is disabled.'
          )
        );
        this._failedJobCount++;
      }

      return handle;
    }

    runTaskBatch<T = unknown>(
      jobs: Array<{
        handlerName: string;
        payload: unknown;
        options?: WorkerTaskOptions;
      }>
    ): Array<WorkerTaskHandle<T>> {
      this._throwIfDisposed();
      const handles: Array<WorkerTaskHandle<T>> = [];
      for (const job of jobs) {
        handles.push(
          this.runTask<T>(job.handlerName, job.payload, job.options || undefined)
        );
      }
      return handles;
    }

    createTaskQueue(options?: WorkerTaskQueueOptions): WorkerTaskQueue {
      this._throwIfDisposed();
      return new gdjs.WorkerTaskQueue(this, options);
    }

    setDebugMessageLogLevel(logLevel: WorkerMessageLogLevel): void {
      this._debugMessageLogLevel = normalizeWorkerMessageLogLevel(logLevel);
    }

    cancelTask(jobId: string): boolean {
      const runningJob = this._runningJobs.get(jobId);
      if (runningJob) {
        this._abortRunningJob(
          runningJob,
          new gdjs.WorkerTaskCancelledError(
            'The worker task "' + runningJob.handlerName + '" was cancelled.'
          )
        );
        return true;
      }

      const pendingJobIndex = this._pendingJobs.findIndex(
        (pendingJob) => pendingJob.id === jobId
      );
      if (pendingJobIndex === -1) {
        return false;
      }

      const [pendingJob] = this._pendingJobs.splice(pendingJobIndex, 1);
      this._clearTimeout(pendingJob);
      pendingJob.handle._markFailed(
        new gdjs.WorkerTaskCancelledError(
          'The worker task "' + pendingJob.handlerName + '" was cancelled.'
        )
      );
      this._cancelledJobCount++;
      return true;
    }

    getStats(): MultithreadStats {
      const activeWorkerCountByRole = createCountByRole();
      for (const workerSlot of this._workerSlots) {
        incrementCountByRole(activeWorkerCountByRole, workerSlot.role);
      }

      const queuedJobCountByRole = createCountByRole();
      for (const pendingJob of this._pendingJobs) {
        incrementCountByRole(queuedJobCountByRole, pendingJob.workerRole);
      }

      const runningJobCountByRole = createCountByRole();
      for (const runningJob of this._runningJobs.values()) {
        incrementCountByRole(runningJobCountByRole, runningJob.workerRole);
      }

      return {
        configuredWorkerCount: this._configuredWorkerCount,
        activeWorkerCount: this._workerSlots.length,
        busyWorkerCount: this._workerSlots.filter((workerSlot) => workerSlot.busy)
          .length,
        queuedJobCount: this._pendingJobs.length,
        runningJobCount: this._runningJobs.size,
        completedJobCount: this._completedJobCount,
        failedJobCount: this._failedJobCount,
        cancelledJobCount: this._cancelledJobCount,
        supportsWorkers: this._supportsWorkers,
        isUsingWorkers:
          this._supportsWorkers &&
          this._workerSlots.some(
            (workerSlot) => workerSlot.busy || workerSlot.currentJobId !== null
          ),
        registeredHandlerCount: workerTaskHandlers.size,
        activeWorkerCountByRole,
        queuedJobCountByRole,
        runningJobCountByRole,
      };
    }

    supportsWorkers(): boolean {
      return this._supportsWorkers;
    }

    dispose(): void {
      if (this._disposed) {
        return;
      }

      const disposeError = new gdjs.WorkerTaskCancelledError(
        'The multithread manager was disposed.'
      );

      for (const pendingJob of this._pendingJobs) {
        this._clearTimeout(pendingJob);
        pendingJob.handle._markFailed(disposeError);
        this._cancelledJobCount++;
      }
      this._pendingJobs.length = 0;

      for (const runningJob of this._runningJobs.values()) {
        this._clearTimeout(runningJob);
        runningJob.handle._markFailed(disposeError);
        this._cancelledJobCount++;
      }
      this._runningJobs.clear();

      this._disposeWorkers();
      if (this._workerScriptUrl) {
        URL.revokeObjectURL(this._workerScriptUrl);
        this._workerScriptUrl = null;
      }
      this._disposed = true;
    }
  }
}
