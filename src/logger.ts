const { createLogger, format, transports } = require('winston');
const { config } = require('./../config.json');

const httpTransportOptions = {
  host: 'http-intake.logs.datadoghq.com',
  path: `/api/v2/logs?dd-api-key=${config.datadog}&ddsource=nodejs&service=texting-backend`,
  ssl: true
};

export const logger = createLogger({
  level: 'info',
  exitOnError: false,
  format: format.json(),
  transports: [
    new transports.Http(httpTransportOptions),
  ],
},{
  level: 'warn',
  exitOnError: false,
  format: format.json(),
  transports: [
    new transports.Http(httpTransportOptions),
  ],
},
{
  level: 'debug',
  exitOnError: false,
  format: format.json(),
  transports: [
    new transports.Http(httpTransportOptions),
  ]
  },
  {
    level: 'error',
    exitOnError: false,
    format: format.json(),
    transports: [
      new transports.Http(httpTransportOptions),
    ]
  });