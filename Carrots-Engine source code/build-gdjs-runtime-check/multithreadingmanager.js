var gdjs;(function(l){const c=new l.Logger("Multithreading"),p="gdjs.multithreading.v2",k=new Map,v=()=>typeof navigator!="undefined"&&typeof navigator.hardwareConcurrency=="number"&&navigator.hardwareConcurrency>1?Math.max(1,Math.min(8,navigator.hardwareConcurrency-1)):1,y=o=>typeof o!="number"||!isFinite(o)?v():Math.max(1,Math.floor(o)),_=o=>{if(o instanceof Error)return o;const e=new Error(String(o));return e.name="Error",e},J=o=>{const e=o&&typeof o=="object"?o:null,n=new Error(e&&typeof e.message=="string"?e.message:"Worker task failed.");return n.name=e&&typeof e.name=="string"?e.name:"WorkerTaskError",e&&typeof e.stack=="string"&&(n.stack=e.stack),n},g=()=>({generic:0,physics:0,loader:0}),f=(o,e)=>{o[e]++},E=()=>typeof performance!="undefined"&&typeof performance.now=="function"?performance.now():Date.now(),b=o=>o==="high"||o==="low"?o:"normal",C=o=>{switch(o){case"high":return 2;case"low":return 0;case"normal":default:return 1}},T=o=>{switch(o){case"physics":case"loader":case"generic":return o;default:return"generic"}},m=o=>o==="off"||o==="verbose"?o:"errors",W=(o,e)=>typeof o!="number"||!isFinite(o)?e:Math.max(0,Math.floor(o)),M=o=>typeof o!="number"||!isFinite(o)?4:Math.max(1,Math.floor(o)),S=(o,e,n)=>{const r=Math.max(1,o),t=r>=2?1:0,s=r>=2?1:0;let i=W(e,t),a=W(n,s);if(i+a>r){const h=i+a-r;if(a>=h)a-=h;else{const P=h-a;a=0,i=Math.max(0,i-P)}}const u=Math.max(0,r-i-a),d=[];for(let h=0;h<i;h++)d.push("physics");for(let h=0;h<a;h++)d.push("loader");for(let h=0;h<u;h++)d.push("generic");return d.length===0&&d.push("generic"),d},R=o=>{const e=o&&typeof o=="object"?o:null;return!!e&&e.__gdjsTransferableWorkerTaskResult===!0&&Array.isArray(e.transferables)},w=o=>{const e=new Set,n=[];for(const r of o)e.has(r)||(e.add(r),n.push(r));return n},I=o=>R(o)?o.value:o;l.createTransferableWorkerTaskResult=(o,e)=>({__gdjsTransferableWorkerTaskResult:!0,value:o,transferables:w(e)});const x=o=>{if(!o||typeof o!="object")return!1;const e=o;return e.protocol===p&&(e.route==="job"||e.route==="system")&&typeof e.messageType=="string"},H=()=>`
const workerProtocol = '${p}';
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
`;class O extends Error{constructor(e="The worker task was cancelled."){super(e);this.name="WorkerTaskCancelledError"}}l.WorkerTaskCancelledError=O;class L extends Error{constructor(e="The worker task timed out."){super(e);this.name="WorkerTaskTimeoutError"}}l.WorkerTaskTimeoutError=L,l.registerWorkerTaskHandler=(o,e)=>{const n=o.trim();if(!n)throw new Error("Worker task handlers must have a non-empty name.");const r=e.toString();if(!r||r.includes("[native code]"))throw new Error("Worker task handlers must be declared in JavaScript and serializable.");const t=k.get(n);k.set(n,{handler:e,source:r,version:t?t.version+1:1})},l.unregisterWorkerTaskHandler=o=>k.delete(o),l.hasWorkerTaskHandler=o=>k.has(o);class q{constructor(e,n){this._status="queued";this._result=null;this._error=null;this.id=n,this._manager=e,this.promise=new Promise((r,t)=>{this._resolve=r,this._reject=t})}cancel(){return this._manager?this._manager.cancelTask(this.id):!1}getStatus(){return this._status}isFinished(){return this._status==="completed"||this._status==="failed"||this._status==="cancelled"}getResult(){return this._result}getError(){return this._error}_markRunning(){this.isFinished()||(this._status="running")}_markCompleted(e){this.isFinished()||(this._status="completed",this._result=e,this._manager=null,this._resolve(e))}_markFailed(e){this.isFinished()||(this._status=e instanceof l.WorkerTaskCancelledError?"cancelled":"failed",this._error=e,this._manager=null,this._reject(e))}}l.WorkerTaskHandle=q;class z extends l.AsyncTask{constructor(e){super();this._isSettled=!1;this._result=null;this._error=null;this._handle=e,e.promise.then(n=>{this._isSettled=!0,this._result=n},n=>{this._isSettled=!0,this._error=n})}update(){return this._isSettled}wasSuccessful(){return this._isSettled&&this._error===null}getResult(){return this._result}getError(){return this._error}getHandle(){return this._handle}cancel(){return this._handle.cancel()}getNetworkSyncData(){return null}updateFromNetworkSyncData(e){}}l.WorkerTask=z;class U{constructor(e,n){this._disposed=!1;this._pendingEntries=[];this._runningEntries=new Map;this._taskIndex=0;this._completedTaskCount=0;this._failedTaskCount=0;this._cancelledTaskCount=0;this._drainResolvers=[];this._manager=e,this._name=n?.name&&n.name.trim()?n.name.trim():"worker-task-queue",this._maxConcurrentTasks=M(n?.maxConcurrentTasks),this._paused=n?.autoStart===!1,this._defaultTaskOptions={allowMainThreadFallback:n?.allowMainThreadFallback,workerRole:T(n?.workerRole),priority:b(n?.priority)}}_mergeTaskOptions(e){return{...this._defaultTaskOptions,...e||{}}}_createTaskId(){return this._taskIndex++,this._name+"-task-"+this._taskIndex}_notifyIfDrained(){if(!(this._pendingEntries.length>0||this._runningEntries.size>0))for(;this._drainResolvers.length>0;){const e=this._drainResolvers.shift();e&&e()}}_startEntry(e){e.status="running";const n=this._mergeTaskOptions(e.options);let r;try{r=this._manager.runTask(e.handlerName,e.payload,n)}catch(t){e.status="failed",this._failedTaskCount++,e.reject(t),this._notifyIfDrained();return}e.runningHandle=r,this._runningEntries.set(e.id,e),r.promise.then(t=>{this._runningEntries.delete(e.id),e.runningHandle=null,e.status==="cancelled"?(this._cancelledTaskCount++,e.reject(e.cancellationError)):(e.status="completed",this._completedTaskCount++,e.resolve(t)),this._schedule(),this._notifyIfDrained()},t=>{this._runningEntries.delete(e.id),e.runningHandle=null,e.status==="cancelled"||t instanceof l.WorkerTaskCancelledError?(e.status="cancelled",this._cancelledTaskCount++):(e.status="failed",this._failedTaskCount++),e.reject(t),this._schedule(),this._notifyIfDrained()})}_schedule(){if(!(this._disposed||this._paused))for(;this._pendingEntries.length>0&&this._runningEntries.size<this._maxConcurrentTasks;){const e=this._pendingEntries.shift();!e||this._startEntry(e)}}enqueue(e,n,r){if(this._disposed){const d=new l.WorkerTaskCancelledError('The worker task queue "'+this._name+'" was disposed.');return{id:this._createTaskId(),promise:Promise.reject(d),cancel:()=>!1,getStatus:()=>"cancelled"}}let t,s;const i=new Promise((d,h)=>{t=d,s=h}),a=this._createTaskId(),u={id:a,handlerName:e,payload:n,options:r,status:"queued",resolve:t,reject:s,runningHandle:null,cancellationError:new l.WorkerTaskCancelledError('The worker queued task "'+a+'" was cancelled.')};return this._pendingEntries.push(u),this._schedule(),{id:a,promise:i,cancel:()=>this.cancelTask(a),getStatus:()=>u.status}}enqueueBatch(e){const n=[];for(const r of e)n.push(this.enqueue(r.handlerName,r.payload,r.options));return n}cancelTask(e){const n=this._pendingEntries.findIndex(i=>i.id===e);if(n!==-1){const[i]=this._pendingEntries.splice(n,1);return i.status="cancelled",this._cancelledTaskCount++,i.reject(i.cancellationError),this._notifyIfDrained(),!0}const r=this._runningEntries.get(e);if(!r||!r.runningHandle)return!1;const t=r.status;r.status="cancelled";const s=r.runningHandle.cancel();return s||(r.status=t),s}pause(){this._paused=!0}resume(){this._paused=!1,this._schedule()}isPaused(){return this._paused}clearPendingTasks(){let e=0;for(;this._pendingEntries.length>0;){const n=this._pendingEntries.shift();!n||(n.status="cancelled",this._cancelledTaskCount++,n.reject(n.cancellationError),e++)}return this._notifyIfDrained(),e}async drain(){if(!(this._pendingEntries.length===0&&this._runningEntries.size===0))return new Promise(e=>{this._drainResolvers.push(e)})}getStats(){return{name:this._name,isPaused:this._paused,maxConcurrentTasks:this._maxConcurrentTasks,pendingTaskCount:this._pendingEntries.length,runningTaskCount:this._runningEntries.size,completedTaskCount:this._completedTaskCount,failedTaskCount:this._failedTaskCount,cancelledTaskCount:this._cancelledTaskCount}}dispose(){if(!this._disposed){this._disposed=!0,this._paused=!0,this.clearPendingTasks();for(const e of this._runningEntries.values())!e.runningHandle||(e.status="cancelled",e.runningHandle.cancel());this._notifyIfDrained()}}}l.WorkerTaskQueue=U;class A{constructor(e){this._disposed=!1;this._workerScriptUrl=null;this._workerSlots=[];this._pendingJobs=[];this._runningJobs=new Map;this._jobIndex=0;this._enqueueOrder=0;this._completedJobCount=0;this._failedJobCount=0;this._cancelledJobCount=0;this._enabled=e?.enabled!==!1,this._allowMainThreadFallback=e?.allowMainThreadFallback!==!1,this._configuredWorkerCount=y(e?.workerCount),this._configuredWorkerRoles=S(this._configuredWorkerCount,e?.physicsWorkerCount,e?.loaderWorkerCount),this._configuredWorkerCount=this._configuredWorkerRoles.length,this._debugMessageLogLevel=m(e?.debugMessageLogLevel),this._supportsWorkers=this._detectWorkerSupport()}_detectWorkerSupport(){return this._enabled&&typeof Worker!="undefined"&&typeof Blob!="undefined"&&typeof URL!="undefined"&&typeof URL.createObjectURL=="function"}_throwIfDisposed(){if(this._disposed)throw new Error("The multithread manager was already disposed.")}_logThreadMessage(e,n,r){this._debugMessageLogLevel==="verbose"&&c.info("[Thread "+e.toUpperCase()+"] worker#"+n.index+" role="+n.role+" route="+r.route+" type="+r.messageType+(r.jobId?" job="+r.jobId:""))}_logThreadError(e,n){this._debugMessageLogLevel!=="off"&&(n!==void 0?c.warn(e,n):c.warn(e))}_canUseWorkersForJob(e){return this._supportsWorkers&&!e.preferMainThread}_shouldUseMainThreadFallback(e){return e.preferMainThread||!this._canUseWorkersForJob(e)&&e.allowMainThreadFallback}_getWorkerCompatibilityWeight(e,n){return e.role===n.workerRole?3:e.role==="generic"?2:n.workerRole==="generic"?1:0}_findNextPendingJobIndexForWorkerSlot(e){let n=-1,r=-1,t=-1,s=Number.POSITIVE_INFINITY;for(let i=0;i<this._pendingJobs.length;i++){const a=this._pendingJobs[i],u=this._getWorkerCompatibilityWeight(e,a);if(u<=0)continue;const d=C(a.priority);(d>t||d===t&&u>r||d===t&&u===r&&a.enqueueOrder<s)&&(n=i,r=u,t=d,s=a.enqueueOrder)}return n}_createJobId(){return this._jobIndex++,"worker-job-"+this._jobIndex}_getHandlerDescriptor(e){const n=k.get(e);if(!n)throw new Error('No worker task handler is registered under "'+e+'".');return n}_ensureWorkerScriptUrl(){if(this._workerScriptUrl)return this._workerScriptUrl;const e=H();return this._workerScriptUrl=URL.createObjectURL(new Blob([e],{type:"application/javascript"})),this._workerScriptUrl}_createWorkerSlot(e){const n=new Worker(this._ensureWorkerScriptUrl()),r={index:e,role:this._configuredWorkerRoles[e]||"generic",worker:n,busy:!1,currentJobId:null,knownHandlerVersions:new Map};return n.onmessage=t=>{const s=t?t.data:null;if(!x(s)){this._logThreadError("Worker sent an invalid message envelope. Replacing worker slot.",s);const u=r.currentJobId;r.busy=!1,r.currentJobId=null,u&&this._failJob(u,new Error("A worker sent an invalid message envelope.")),this._disposed||(this._replaceWorkerSlot(e),this._schedulePendingJobs());return}if(this._logThreadMessage("in",r,s),s.route==="system"){this._logThreadError("Worker reported a system-level message.",s.payload);const u=r.currentJobId;r.busy=!1,r.currentJobId=null,u&&this._failJob(u,new Error("Worker reported a system-level failure.")),this._disposed||(this._replaceWorkerSlot(e),this._schedulePendingJobs());return}if(typeof s.jobId!="string"){this._logThreadError("Worker sent a job message without a valid job id.",s);const u=r.currentJobId;r.busy=!1,r.currentJobId=null,u&&this._failJob(u,new Error("Worker sent a message without a valid job id.")),this._disposed||(this._replaceWorkerSlot(e),this._schedulePendingJobs());return}if(!this._runningJobs.get(s.jobId))return;r.busy=!1,r.currentJobId=null;const a=s.payload&&typeof s.payload=="object"?s.payload:null;s.messageType==="job.completed"?this._completeJob(s.jobId,a?a.result:void 0):s.messageType==="job.failed"?this._failJob(s.jobId,J(a?a.error:null)):this._failJob(s.jobId,new Error("Worker returned an unsupported job message type.")),this._schedulePendingJobs()},n.onerror=t=>{this._logThreadError("Worker runtime error.",{message:t.message,filename:t.filename,lineno:t.lineno,colno:t.colno});const s=r.currentJobId;if(r.busy=!1,r.currentJobId=null,s){const i=new Error(t.message||"The worker terminated with an error.");i.name="WorkerRuntimeError",this._failJob(s,i)}this._disposed||(this._replaceWorkerSlot(e),this._schedulePendingJobs())},n.onmessageerror=()=>{this._logThreadError("Worker message deserialization error in main thread message channel.");const t=r.currentJobId;r.busy=!1,r.currentJobId=null,t&&this._failJob(t,new Error("A worker sent data that could not be deserialized.")),this._disposed||(this._replaceWorkerSlot(e),this._schedulePendingJobs())},r}_replaceWorkerSlot(e){const n=this._workerSlots[e];if(n&&n.worker.terminate(),!(!this._supportsWorkers||this._disposed))try{this._workerSlots[e]=this._createWorkerSlot(e)}catch(r){c.warn("Falling back to the main thread after a worker recreation failure:",r),this._supportsWorkers=!1,this._disposeWorkers()}}_ensureWorkerPool(){if(!this._supportsWorkers)return!1;try{for(;this._workerSlots.length<this._configuredWorkerCount;){const e=this._workerSlots.length;this._workerSlots.push(this._createWorkerSlot(e))}return!0}catch(e){return c.warn("Falling back to the main thread because workers could not be created:",e),this._supportsWorkers=!1,this._disposeWorkers(),!1}}_disposeWorkers(){for(const e of this._workerSlots)e.worker.terminate();this._workerSlots.length=0}_startTimeout(e){e.timeoutMs===null||e.timeoutMs<=0||(e.timeoutId=window.setTimeout(()=>{const n=this._runningJobs.get(e.id);if(n){this._abortRunningJob(n,new l.WorkerTaskTimeoutError('The worker task "'+e.handlerName+'" timed out.'));return}const r=this._pendingJobs.findIndex(t=>t.id===e.id);if(r!==-1){const[t]=this._pendingJobs.splice(r,1);this._clearTimeout(t),t.handle._markFailed(new l.WorkerTaskTimeoutError('The queued worker task "'+e.handlerName+'" timed out.')),this._failedJobCount++}},e.timeoutMs))}_clearTimeout(e){e.timeoutId!==null&&(clearTimeout(e.timeoutId),e.timeoutId=null)}_runJobOnMainThread(e){e.isRunningOnMainThread=!0,e.handle._markRunning(),this._runningJobs.set(e.id,e),Promise.resolve().then(()=>e.handler(e.payload,{jobId:e.id,handlerName:e.handlerName,isWorkerThread:!1})).then(n=>{!this._runningJobs.has(e.id)||this._completeJob(e.id,I(n))},n=>{!this._runningJobs.has(e.id)||this._failJob(e.id,_(n))})}_dispatchJobToWorker(e,n){const r=this._workerSlots[n],t=r.knownHandlerVersions.get(e.handlerName)!==e.handlerVersion;try{r.busy=!0,r.currentJobId=e.id,e.slotIndex=n,e.handle._markRunning(),this._runningJobs.set(e.id,e);const s={protocol:p,route:"job",messageType:"job.run",jobId:e.id,payload:{handlerName:e.handlerName,handlerVersion:e.handlerVersion,handlerSource:t?e.handlerSource:void 0,payload:e.payload,workerRole:e.workerRole,priority:e.priority},sentAt:E()};return this._logThreadMessage("out",r,s),r.worker.postMessage(s,w(e.transferables)),r.knownHandlerVersions.set(e.handlerName,e.handlerVersion),!0}catch(s){return r.busy=!1,r.currentJobId=null,e.slotIndex=null,e.allowMainThreadFallback?(this._runningJobs.delete(e.id),c.warn("Running worker task on the main thread after worker dispatch failure:",s),this._runJobOnMainThread(e),!0):(this._failJob(e.id,_(s)),!1)}}_schedulePendingJobs(){if(!(this._disposed||this._pendingJobs.length===0)){if(!this._ensureWorkerPool()){if(!this._allowMainThreadFallback){for(;this._pendingJobs.length>0;){const e=this._pendingJobs.shift();!e||(this._clearTimeout(e),e.handle._markFailed(new Error("Worker tasks are unavailable and the main thread fallback is disabled.")),this._failedJobCount++)}return}for(;this._pendingJobs.length>0;){const e=this._pendingJobs.shift();!e||this._runJobOnMainThread(e)}return}for(let e=0;e<this._workerSlots.length;++e){const n=this._workerSlots[e];if(n.busy)continue;const r=this._findNextPendingJobIndexForWorkerSlot(n);if(r===-1)continue;const[t]=this._pendingJobs.splice(r,1);!t||this._dispatchJobToWorker(t,e)}}}_completeJob(e,n){const r=this._runningJobs.get(e);!r||(this._runningJobs.delete(e),this._clearTimeout(r),r.handle._markCompleted(n),this._completedJobCount++)}_failJob(e,n){const r=this._runningJobs.get(e);if(r){this._runningJobs.delete(e),this._clearTimeout(r),r.handle._markFailed(n),this._failedJobCount++;return}const t=this._pendingJobs.findIndex(i=>i.id===e);if(t===-1)return;const[s]=this._pendingJobs.splice(t,1);this._clearTimeout(s),s.handle._markFailed(n),this._failedJobCount++}_abortRunningJob(e,n){this._runningJobs.delete(e.id),this._clearTimeout(e),e.handle._markFailed(n),e.slotIndex!==null&&!e.isRunningOnMainThread&&this._replaceWorkerSlot(e.slotIndex),n instanceof l.WorkerTaskCancelledError?this._cancelledJobCount++:this._failedJobCount++,this._schedulePendingJobs()}runTask(e,n,r){this._throwIfDisposed();const t=this._getHandlerDescriptor(e),s=this._createJobId(),i=new l.WorkerTaskHandle(this,s),a={id:s,handlerName:e,handlerVersion:t.version,handlerSource:t.source,handler:t.handler,payload:n,transferables:r?.transferables||[],timeoutMs:typeof r?.timeoutMs=="number"&&isFinite(r.timeoutMs)?Math.max(1,Math.floor(r.timeoutMs)):null,allowMainThreadFallback:r?.allowMainThreadFallback!==void 0?r.allowMainThreadFallback:this._allowMainThreadFallback,preferMainThread:r?.preferMainThread===!0,workerRole:T(r?.workerRole),priority:b(r?.priority),enqueueOrder:this._enqueueOrder++,handle:i,timeoutId:null,slotIndex:null,isRunningOnMainThread:!1};return this._startTimeout(a),this._shouldUseMainThreadFallback(a)?this._runJobOnMainThread(a):this._canUseWorkersForJob(a)?(this._pendingJobs.push(a),this._schedulePendingJobs()):(a.handle._markFailed(new Error("Worker tasks are unavailable and the main thread fallback is disabled.")),this._failedJobCount++),i}runTaskBatch(e){this._throwIfDisposed();const n=[];for(const r of e)n.push(this.runTask(r.handlerName,r.payload,r.options||void 0));return n}createTaskQueue(e){return this._throwIfDisposed(),new l.WorkerTaskQueue(this,e)}setDebugMessageLogLevel(e){this._debugMessageLogLevel=m(e)}cancelTask(e){const n=this._runningJobs.get(e);if(n)return this._abortRunningJob(n,new l.WorkerTaskCancelledError('The worker task "'+n.handlerName+'" was cancelled.')),!0;const r=this._pendingJobs.findIndex(s=>s.id===e);if(r===-1)return!1;const[t]=this._pendingJobs.splice(r,1);return this._clearTimeout(t),t.handle._markFailed(new l.WorkerTaskCancelledError('The worker task "'+t.handlerName+'" was cancelled.')),this._cancelledJobCount++,!0}getStats(){const e=g();for(const t of this._workerSlots)f(e,t.role);const n=g();for(const t of this._pendingJobs)f(n,t.workerRole);const r=g();for(const t of this._runningJobs.values())f(r,t.workerRole);return{configuredWorkerCount:this._configuredWorkerCount,activeWorkerCount:this._workerSlots.length,busyWorkerCount:this._workerSlots.filter(t=>t.busy).length,queuedJobCount:this._pendingJobs.length,runningJobCount:this._runningJobs.size,completedJobCount:this._completedJobCount,failedJobCount:this._failedJobCount,cancelledJobCount:this._cancelledJobCount,supportsWorkers:this._supportsWorkers,isUsingWorkers:this._supportsWorkers&&this._workerSlots.some(t=>t.busy||t.currentJobId!==null),registeredHandlerCount:k.size,activeWorkerCountByRole:e,queuedJobCountByRole:n,runningJobCountByRole:r}}supportsWorkers(){return this._supportsWorkers}dispose(){if(this._disposed)return;const e=new l.WorkerTaskCancelledError("The multithread manager was disposed.");for(const n of this._pendingJobs)this._clearTimeout(n),n.handle._markFailed(e),this._cancelledJobCount++;this._pendingJobs.length=0;for(const n of this._runningJobs.values())this._clearTimeout(n),n.handle._markFailed(e),this._cancelledJobCount++;this._runningJobs.clear(),this._disposeWorkers(),this._workerScriptUrl&&(URL.revokeObjectURL(this._workerScriptUrl),this._workerScriptUrl=null),this._disposed=!0}}l.MultithreadManager=A})(gdjs||(gdjs={}));
//# sourceMappingURL=multithreadingmanager.js.map
