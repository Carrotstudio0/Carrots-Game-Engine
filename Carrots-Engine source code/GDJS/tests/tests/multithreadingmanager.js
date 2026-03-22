(() => {
  const handlerNames = {
    compute: 'Tests::Multithreading::compute',
    fallback: 'Tests::Multithreading::fallback',
    sum: 'Tests::Multithreading::sum',
    delay: 'Tests::Multithreading::delay',
  };

  describe('gdjs.MultithreadManager', function () {
    before(() => {
      gdjs.registerWorkerTaskHandler(
        handlerNames.compute,
        (payload, context) => ({
          doubled: payload.value * 2,
          onWorker: context.isWorkerThread,
        })
      );
      gdjs.registerWorkerTaskHandler(
        handlerNames.fallback,
        (_payload, context) => context.isWorkerThread
      );
      gdjs.registerWorkerTaskHandler(handlerNames.sum, (payload) =>
        payload.values.reduce((sum, value) => sum + value, 0)
      );
      gdjs.registerWorkerTaskHandler(handlerNames.delay, async (payload) => {
        await new Promise((resolve) => setTimeout(resolve, payload.delayMs));
        return payload.value;
      });
    });

    after(() => {
      gdjs.unregisterWorkerTaskHandler(handlerNames.compute);
      gdjs.unregisterWorkerTaskHandler(handlerNames.fallback);
      gdjs.unregisterWorkerTaskHandler(handlerNames.sum);
      gdjs.unregisterWorkerTaskHandler(handlerNames.delay);
    });

    it('should execute a worker task and expose the result through the handle', async function () {
      const runtimeGame = gdjs.getPixiRuntimeGame();

      try {
        const handle = runtimeGame
          .getMultithreadManager()
          .runTask(handlerNames.compute, { value: 21 });
        const result = await handle.promise;

        expect(result.doubled).to.be(42);
        expect(handle.getStatus()).to.be('completed');
        expect(runtimeGame.getMultithreadManager().getStats().completedJobCount).to.be(
          1
        );
      } finally {
        runtimeGame.dispose(true);
      }
    });

    it('should fallback to the main thread when multithreading is disabled', async function () {
      const runtimeGame = new gdjs.RuntimeGame(gdjs.createProjectData(), {
        multithreading: {
          enabled: false,
        },
      });

      try {
        const handle = runtimeGame
          .getMultithreadManager()
          .runTask(handlerNames.fallback, {});
        const ranOnWorker = await handle.promise;

        expect(ranOnWorker).to.be(false);
        expect(runtimeGame.getMultithreadManager().supportsWorkers()).to.be(
          false
        );
      } finally {
        runtimeGame.dispose(true);
      }
    });

    it('should settle worker tasks through the scene async task manager on the next frame', async function () {
      const runtimeGame = gdjs.getPixiRuntimeGame();
      const runtimeScene = new gdjs.RuntimeScene(runtimeGame);
      let callbackResult = null;
      let callbackTaskError = null;

      try {
        const workerTask = runtimeScene.addWorkerTask(
          handlerNames.sum,
          { values: [1, 2, 3, 4] },
          (_runtimeScene, result, task) => {
            callbackResult = result;
            callbackTaskError = task.getError();
          }
        );

        expect(callbackResult).to.be(null);
        await workerTask.getHandle().promise;
        expect(callbackResult).to.be(null);

        runtimeScene.getAsyncTasksManager().processTasks(runtimeScene);

        expect(callbackResult).to.be(10);
        expect(callbackTaskError).to.be(null);
      } finally {
        runtimeGame.dispose(true);
      }
    });

    it('should cancel queued tasks when the worker pool is saturated', async function () {
      const runtimeGame = new gdjs.RuntimeGame(gdjs.createProjectData(), {
        multithreading: {
          workerCount: 1,
        },
      });

      try {
        if (!runtimeGame.getMultithreadManager().supportsWorkers()) {
          this.skip();
          return;
        }

        const firstHandle = runtimeGame
          .getMultithreadManager()
          .runTask(handlerNames.delay, {
            delayMs: 40,
            value: 1,
          });
        const secondHandle = runtimeGame
          .getMultithreadManager()
          .runTask(handlerNames.delay, {
            delayMs: 0,
            value: 2,
          });

        expect(secondHandle.cancel()).to.be(true);

        let cancellationError = null;
        try {
          await secondHandle.promise;
        } catch (error) {
          cancellationError = error;
        }

        expect(cancellationError).not.to.be(null);
        expect(cancellationError.name).to.be('WorkerTaskCancelledError');
        expect(await firstHandle.promise).to.be(1);
        expect(runtimeGame.getMultithreadManager().getStats().cancelledJobCount).to.be(
          1
        );
      } finally {
        runtimeGame.dispose(true);
      }
    });
  });
})();
