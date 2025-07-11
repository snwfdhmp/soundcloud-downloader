/** @internal @packageDocumentation */

import { AxiosInstance } from "axios";
import m3u8stream from "m3u8stream";
import { handleRequestErrs, appendURL } from "./util";
import getInfo, { Transcoding } from "./info";

export const getMediaURL = async (
  url: string,
  clientID: string,
  axiosInstance: AxiosInstance
): Promise<string> => {
  const res = await axiosInstance.get(appendURL(url, "client_id", clientID), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36",
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
    },
    withCredentials: true,
  });
  if (!res.data.url)
    throw new Error(
      `Invalid response from Soundcloud. Check if the URL provided is correct: ${url}`
    );
  return res.data.url;
};

export const getProgressiveStream = async (
  mediaUrl: string,
  axiosInstance: AxiosInstance
): Promise<NodeJS.ReadableStream> => {
  const r = await axiosInstance.get(mediaUrl, {
    withCredentials: true,
    responseType: "stream",
  });

  return r.data;
};

export const getHLSStream = (mediaUrl: string): m3u8stream.Stream =>
  m3u8stream(mediaUrl);

type fromURLFunctionBase = (
  url: string,
  clientID: string,
  getMediaURLFunction: (
    url: string,
    clientID: string,
    axiosInstance: AxiosInstance
  ) => Promise<string>,
  getProgressiveStreamFunction: (
    mediaUrl: string,
    axiosInstance: AxiosInstance
  ) => Promise<NodeJS.ReadableStream>,
  getHLSStreamFunction: (mediaUrl: string) => m3u8stream.Stream,
  axiosInstance: AxiosInstance
) => Promise<NodeJS.ReadableStream | m3u8stream.Stream>;

export const fromURLBase: fromURLFunctionBase = async (
  url: string,
  clientID: string,
  getMediaURLFunction: (
    url: string,
    clientID: string,
    axiosInstance: AxiosInstance
  ) => Promise<string>,
  getProgressiveStreamFunction: (
    mediaUrl: string,
    axiosInstance: AxiosInstance
  ) => Promise<NodeJS.ReadableStream>,
  getHLSStreamFunction: (mediaUrl: string) => m3u8stream.Stream,
  axiosInstance: AxiosInstance
): Promise<NodeJS.ReadableStream | m3u8stream.Stream> => {
  try {
    const mediaUrl = await getMediaURLFunction(url, clientID, axiosInstance);

    if (url.includes("/progressive")) {
      return await getProgressiveStreamFunction(mediaUrl, axiosInstance);
    }

    return getHLSStreamFunction(mediaUrl);
  } catch (err) {
    throw handleRequestErrs(err);
  }
};

export const fromURL = async (
  url: string,
  clientID: string,
  axiosInstance: AxiosInstance
): Promise<NodeJS.ReadableStream | m3u8stream.Stream> =>
  await fromURLBase(
    url,
    clientID,
    getMediaURL,
    getProgressiveStream,
    getHLSStream,
    axiosInstance
  );

export const fromMediaObjBase = async (
  media: Transcoding,
  clientID: string,
  getMediaURLFunction: (
    url: string,
    clientID: string,
    axiosInstance: AxiosInstance
  ) => Promise<string>,
  getProgressiveStreamFunction: (
    mediaUrl: string,
    axiosInstance: AxiosInstance
  ) => Promise<NodeJS.ReadableStream>,
  getHLSStreamFunction: (mediaUrl: string) => m3u8stream.Stream,
  fromURLFunction: typeof fromURL,
  axiosInstance: AxiosInstance
): Promise<NodeJS.ReadableStream | m3u8stream.Stream> => {
  if (!validatemedia(media)) throw new Error("Invalid media object provided");
  return await fromURLFunction(media.url, clientID, axiosInstance);
};

export const fromMediaObj = async (
  media: Transcoding,
  clientID: string,
  axiosInstance: AxiosInstance
): Promise<NodeJS.ReadableStream | m3u8stream.Stream> =>
  await fromMediaObjBase(
    media,
    clientID,
    getMediaURL,
    getProgressiveStream,
    getHLSStream,
    fromURL,
    axiosInstance
  );

export const fromDownloadLink = async (
  id: number,
  clientID: string,
  axiosInstance: AxiosInstance
): Promise<NodeJS.ReadableStream> => {
  const {
    data: { redirectUri },
  } = await axiosInstance.get(
    appendURL(
      `https://api-v2.soundcloud.com/tracks/${id}/download`,
      "client_id",
      clientID
    )
  );
  const { data } = await axiosInstance.get(redirectUri, {
    responseType: "stream",
  });

  return data;
};

/** @internal */
export const download = async (
  url: string,
  clientID: string,
  axiosInstance: AxiosInstance,
  useDownloadLink = true
): Promise<NodeJS.ReadableStream | m3u8stream.Stream> => {
  const info = await getInfo(url, clientID, axiosInstance);
  if (info.downloadable && useDownloadLink) {
    // Some tracks have `downloadable` set to true but will return a 404
    // when using download API route.
    try {
      return await fromDownloadLink(info.id, clientID, axiosInstance);
    } catch (err) {}
  }

  if (!info.media) {
    throw new Error("No media found for track");
  }

  return await fromMediaObj(
    info.media.transcodings[0],
    clientID,
    axiosInstance
  );
};

const validatemedia = (media: Transcoding) => {
  return !(!media.url || !media.format);
};
