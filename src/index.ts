import app from '@app'
import { logger } from '@core/logger'

const port = Number(process.env.PORT) || 3001

logger.info(`Server listening on port ${port}`)

export default {
  port,
  fetch: app.fetch,
}
