declare module 'ali-oss' {
  type PutResult = {
    url?: string
    res?: {
      headers?: Record<string, string | undefined>
    }
  }

  type OssClientOptions = {
    region?: string | undefined
    endpoint?: string | undefined
    bucket?: string | undefined
    accessKeyId: string
    accessKeySecret: string
    stsToken?: string | undefined
  }

  export default class OSS {
    constructor(options: OssClientOptions)
    put(
      name: string,
      file: string,
      options?: {
        headers?: Record<string, string>
      }
    ): Promise<PutResult>
    list(options?: Record<string, unknown>): Promise<unknown>
  }
}
