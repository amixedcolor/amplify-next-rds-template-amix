import { runStopCli } from '@aws-blocks/blocks/scripts';

// Stops the dev server started by `pnpm blocks:dev` (by recorded PID).
const args = process.argv.slice(2);
await runStopCli(args.length > 0 ? args : ['--port', '3001']);
