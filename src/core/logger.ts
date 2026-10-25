import pino from 'pino'
import pretty from 'pino-pretty'

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  },
  !isProduction && !isTest
    ? pretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      })
    : undefined
)

export type Logger = typeof logger
