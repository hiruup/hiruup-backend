import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

let stream: pino.DestinationStream | undefined
if (!isProduction && !isTest) {
  try {
    const pretty = (await import('pino-pretty')).default
    stream = pretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    })
  } catch {
    // pino-pretty not installed (production image), fall back to default JSON
  }
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  },
  stream,
)

export type Logger = typeof logger
