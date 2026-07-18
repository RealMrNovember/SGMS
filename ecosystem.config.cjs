/** @type {import('pm2').StartOptions[]} */
const path = require('path');

const APP_ROOT = __dirname;
const NODE_BIN = path.join(APP_ROOT, '.tools/node/bin/node');
const LOG_DIR = path.join(APP_ROOT, 'logs/pm2');

module.exports = {
  apps: [
    {
      name: 'sgms-web',
      cwd: path.join(APP_ROOT, 'apps/web'),
      script: path.join(APP_ROOT, 'apps/web/node_modules/next/dist/bin/next'),
      args: 'start --port 3100 --hostname 127.0.0.1',
      interpreter: NODE_BIN,
      env: {
        NODE_ENV: 'production',
        PORT: '3100',
        HOSTNAME: '127.0.0.1',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '768M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      error_file: path.join(LOG_DIR, 'error.log'),
      out_file: path.join(LOG_DIR, 'out.log'),
      merge_logs: true,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '20M',
      retain: 10,
    },
    {
      name: 'sgms-membership-reminders',
      cwd: path.join(APP_ROOT, 'packages/cloud-client'),
      script: path.join(APP_ROOT, 'packages/cloud-client/dist/reminders-cli.js'),
      interpreter: NODE_BIN,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 9 * * *',
      watch: false,
      error_file: path.join(LOG_DIR, 'reminders-error.log'),
      out_file: path.join(LOG_DIR, 'reminders-out.log'),
      merge_logs: true,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '20M',
      retain: 10,
    },
  ],
};
