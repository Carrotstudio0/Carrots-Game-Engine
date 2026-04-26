const shell = require('shelljs');
const path = require('path');
const fs = require('fs');
const args = require('minimist')(process.argv.slice(2));
const ghpages = require('gh-pages');
const isGitClean = require('is-git-clean');
const git = require('git-rev');

const deployBranch = args['target-branch'] || 'gh-pages';
const allowedBranches = new Set(['main', 'master']);

const ensureCleanRepository = () => {
  if (args['skip-git-check']) return Promise.resolve();

  return isGitClean().then(clean => {
    if (!clean) {
      shell.echo(
        'WARNING: Git repository is not clean. Please commit/stash changes before deploying.'
      );
      shell.exit(1);
    }
  });
};

const ensureAllowedBranch = () =>
  new Promise(resolve => {
    if (args['skip-git-check']) {
      resolve();
      return;
    }

    git.branch(branch => {
      if (!allowedBranches.has(branch)) {
        shell.echo(
          `WARNING: Please run deployment from main/master (current branch: ${branch}).`
        );
        shell.exit(1);
      }

      resolve();
    });
  });

const ensureLibGDArtifacts = () => {
  const appPublicPath = path.join(__dirname, '../../app/public/');
  return new Promise(resolve => {
    fs.stat(path.join(appPublicPath, 'libGD.js'), (err, stats) => {
      if (err) {
        shell.echo(
          `ERROR: Unable to check libGD.js size. Have you compiled GDevelop.js? Error: ${err}`
        );
        shell.exit(1);
      }

      const sizeInMiB = stats.size / 1024 / 1024;
      if (sizeInMiB > 2) {
        shell.echo(
          `ERROR: libGD.js size is too big (${sizeInMiB.toFixed(
            2
          )} MiB). Are you deploying a development build by mistake?`
        );
        shell.exit(1);
      }

      shell.echo(`OK: libGD.js size seems correct (${sizeInMiB.toFixed(2)} MiB).`);

      if (!fs.existsSync(path.join(appPublicPath, 'libGD.wasm'))) {
        shell.echo(
          'ERROR: Did not find libGD.wasm. Please ensure it was built properly.'
        );
        shell.exit(1);
      }
      resolve();
    });
  });
};

const preparePagesDist = () => {
  shell.rm('-rf', 'dist');
  shell.mkdir('-p', 'dist');
  shell.cp('-r', '../app/build/*', 'dist');

  // Use GitHub Pages URL by default and avoid carrying upstream custom domains.
  const cnamePath = path.join('dist', 'CNAME');
  if (args.cname) {
    fs.writeFileSync(cnamePath, `${args.cname}\n`);
    shell.echo(`OK: Using custom CNAME domain ${args.cname}`);
  } else if (fs.existsSync(cnamePath)) {
    fs.unlinkSync(cnamePath);
    shell.echo('OK: Removed CNAME so deployment uses github.io URL.');
  }

  // Ensure files/folders starting with "_" are not filtered by Jekyll.
  fs.closeSync(fs.openSync(path.join('dist', '.nojekyll'), 'w'));

  // SPA fallback for deep links on GitHub Pages.
  const indexPath = path.join('dist', 'index.html');
  const notFoundPath = path.join('dist', '404.html');
  if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, notFoundPath);
  }
};

ensureCleanRepository()
  .then(ensureAllowedBranch)
  .then(ensureLibGDArtifacts)
  .then(() => {
    if (!args['cf-zoneid'] || !args['cf-token']) {
      shell.echo('INFO: No --cf-zoneid/--cf-token provided, cache purge will be skipped.');
    }

    if (!args['skip-app-build']) {
      const output = shell.exec('npm run build:app');
      if (output.code !== 0) {
        shell.echo('ERROR: Unable to build the app.');
        shell.exit(output.code);
      }
    } else {
      shell.echo('INFO: Skipping app build.');
    }

    if (!args['skip-gdjs-runtime-deploy']) {
      const output = shell.exec('npm run deploy:gdjs-runtime');
      if (output.code !== 0) {
        shell.echo('ERROR: Unable to deploy GDJS runtime.');
        shell.exit(output.code);
      }
    } else {
      shell.echo('INFO: Skipping GDJS runtime deployment.');
    }

    preparePagesDist();

    if (args['skip-deploy']) return;

    shell.echo(`Deploying built app to branch "${deployBranch}"...`);
    ghpages.publish(
      'dist',
      { history: false, branch: deployBranch, dotfiles: true },
      err => {
        if (err) {
          shell.echo('ERROR: Deployment failed.');
          shell.echo(err);
          return;
        }

        shell.echo('OK: Upload finished to GitHub.');
        if (!args['cf-zoneid'] || !args['cf-token']) {
          shell.echo('INFO: Reverse-proxy cache purge was skipped.');
        } else {
          shell.exec(
            `npm run deploy:purge-cache -- --cf-zoneid ${args['cf-zoneid']} --cf-token ${args['cf-token']}`
          );
        }
      }
    );
  });
