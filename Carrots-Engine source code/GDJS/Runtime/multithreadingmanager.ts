/*
 * GDevelop JS Platform
 * Copyright 2013-2026 Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  const logger = new gdjs.Logger('Multithreading');

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
  };

  /**
   * @category Core Engine > Multithreading
   */
  export type MultithreadManagerOptions = {
    enabled?: boolean;
    workerCount?: integer;
    allowMainThreadFallback?: boolean;
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
  };

  type WorkerTaskHandlerDescriptor = {
    handler: WorkerTaskHandler;
    source: string;
    version: integer;
  };

  type WorkerSlot = {
    worker: Worker;
    busy: boolean;
    currentJobId: string | null;
    knownHandlerVersions: Map<string, integer>;
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
    handle: WorkerTaskHandle<unknown>;
    timeoutId: number | null;
    slotIndex: integer | null;
    isRunningOnMainThread: boolean;
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

  const createWorkerBootstrapSource = (): string => `
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

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type !== 'runJob') return;

  const {
    jobId,
    handlerName,
    handlerVersion,
    handlerSource,
    payload,
  } = message;

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
      jobId,
      handlerName,
      isWorkerThread: true,
    });

    self.postMessage({
      type: 'jobCompleted',
      jobId,
      result,
    });
  } catch (error) {
    self.postMessage({
      type: 'jobFailed',
      jobId,
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
   * Worker pool and queue used by the runtime to offload heavy serializable
   * computations outside of the main frame loop.
   * @category Core Engine > Multithreading
   */
  export class MultithreadManager {
    private _enabled: boolean;
    private _disposed = false;
    private _allowMainThreadFallback: boolean;
    private _configuredWorkerCount: integer;
    private _supportsWorkers: boolean;
    private _workerScriptUrl: string | null = null;
    private _workerSlots: WorkerSlot[] = [];
    private _pendingJobs: WorkerJob[] = [];
    private _runningJobs = new Map<string, WorkerJob>();
    private _jobIndex = 0;
    private _completedJobCount = 0;
    private _failedJobCount = 0;
    private _cancelledJobCount = 0;

    constructor(options?: MultithreadManagerOptions) {
      this._enabled = options?.enabled !== false;
      this._allowMainThreadFallback = options?.allowMainThreadFallback !== false;
      this._configuredWorkerCount = normalizeWorkerCount(options?.workerCount);
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

    private _canUseWorkersForJob(job: WorkerJob): boolean {
      return this._supportsWorkers && !job.preferMainThread;
    }

    private _shouldUseMainThreadFallback(job: WorkerJob): boolean {
      return (
        job.preferMainThread ||
        (!this._canUseWorkersForJob(job) && job.allowMainThreadFallback)
      );
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
        worker,
        busy: false,
        currentJobId: null,
        knownHandlerVersions: new Map<string, integer>(),
      };

      worker.onmessage = (event: MessageEvent) => {
        const data =
          event && event.data && typeof event.data === 'object'
            ? (event.data as {
                type?: string;
                jobId?: string;
                result?: unknown;
                error?: unknown;
              })
            : null;
        if (!data || typeof data.jobId !== 'string') {
          return;
        }

        const runningJob = this._runningJobs.get(data.jobId);
        if (!runningJob) {
          return;
        }

        workerSlot.busy = false;
        workerSlot.currentJobId = null;

        if (data.type === 'jobCompleted') {
          this._completeJob(data.jobId, data.result);
        } else {
          this._failJob(data.jobId, createWorkerError(data.error));
        }

        this._schedulePendingJobs();
      };

      worker.onerror = (event: ErrorEvent) => {
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
            this._completeJob(job.id, result);
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

        workerSlot.worker.postMessage(
          {
            type: 'runJob',
            jobId: job.id,
            handlerName: job.handlerName,
            handlerVersion: job.handlerVersion,
            handlerSource: shouldSendHandlerSource
              ? job.handlerSource
              : undefined,
            payload: job.payload,
          },
          job.transferables
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
        this._runningJobs.delete(job.id);

        if (job.allowMainThreadFallback) {
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

        const nextJob = this._pendingJobs.shift();
        if (!nextJob) {
          break;
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
          this._workerSlots.length > 0 &&
          !this._pendingJobs.every((job) => job.preferMainThread),
        registeredHandlerCount: workerTaskHandlers.size,
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
