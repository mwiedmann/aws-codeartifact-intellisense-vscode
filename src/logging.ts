export type LoggingMode = 'dev' | 'prod'

let mode: LoggingMode = 'prod'

/**
 * Set the logging mode. The default 'prod' ignores dev logs.
 * @param newMode New logging mode
 */
export const setLoggingMode = (newMode: LoggingMode) => {
  mode = newMode
}

/**
 * These are only logged when the mode is 'dev'
 * otherwise they are ignored
 * @param args Log args
 */
export const devLog = (...args: any) => {
  if (mode === 'dev') {
    console.debug(...args)
  }
}

/**
 * Always log
 * @param args Log args
 */
export const log = (...args: any) => {
  console.log(...args)
}
