declare const __KISSOPEN_LOCAL_WEB_BUILD_ID__: string | null;
declare const __KISSOPEN_LOCAL_WEB_VERSION__: string | null;

export interface LocalWebBuild {
    readonly buildId: string;
    readonly version: string;
}

/**
 * Identity embedded into one hosted renderer deployment. Packaged and
 * development renderers receive null constants and therefore never poll Pages.
 */
export const localWebBuild: LocalWebBuild | undefined =
    __KISSOPEN_LOCAL_WEB_BUILD_ID__ && __KISSOPEN_LOCAL_WEB_VERSION__
        ? {
              buildId: __KISSOPEN_LOCAL_WEB_BUILD_ID__,
              version: __KISSOPEN_LOCAL_WEB_VERSION__,
          }
        : undefined;
