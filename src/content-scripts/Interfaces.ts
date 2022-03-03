/* eslint-disable @typescript-eslint/no-unused-vars */

interface OrganicDetail {
  // Number of pixels between the top of the page and the top of the organic result.
  topHeight: number,
  // Number of pixels between the top of the page and the bottom of the organic result.
  bottomHeight: number,
  // The page number that the organic result was on
  // (only relevant for DuckDuckGo because of the infinite scroll on its SERP pages).
  pageNum: number,
  // The online service of the result only if the result is for one of the tracked online services. If the result is a link for anything besides one of the tracked online services, this property will be null.
  onlineService: string,
}

interface SelfPreferencedDetail {
  // Number of pixels between the top of the page and the top of the organic result.
  topHeight: number,
  // Number of pixels between the top of the page and the bottom of the organic result.
  bottomHeight: number,
  // The type of self-preferenced result that is on the page
  // (flights, hotels, other travel, maps, lyrics, weather, shopping, or other direct answer).
  type: string,
}

interface OrganicClick {
  // The ranking of the selected organic result.
  ranking: number,
  // The attention duration when the click occurred.
  attentionDuration: number,
  // If the whole page had loaded, including all dependent resources such as stylesheets and images when the selection occurred.
  pageLoaded: boolean,
}

interface ElementListeners {
  element: Element,
  clickListener: (event: MouseEvent) => void,
  mousedownListener: (event: MouseEvent) => void
}

interface ReplacementData {
  header: string,
  link: string,
  description: string,
  cite: string,
  citeSpan: string,
}

interface ReplacementDataVariableSubset {
  header: string,
  link: string,
  description: string,
}
