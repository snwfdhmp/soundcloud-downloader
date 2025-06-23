import { AxiosInstance } from "axios";
import { download } from "./download";
import { getSetInfo } from "./info";

export const downloadPlaylist = async (
  url: string,
  clientID: string,
  axiosInstance: AxiosInstance
): Promise<[NodeJS.ReadableStream[], String[]]> => {
  const info = await getSetInfo(url, clientID, axiosInstance);

  const trackNames: string[] = [];
  const result = await Promise.all(
    info.tracks
      .map((track) => {
        if (!track.permalink_url) {
          return null;
        }
        const p = download(track.permalink_url, clientID, axiosInstance);
        trackNames.push(track.title ?? "[NO_TITLE]");
        return p;
      })
      .filter((p) => p !== null)
  );

  return [result as NodeJS.ReadableStream[], trackNames];
};
