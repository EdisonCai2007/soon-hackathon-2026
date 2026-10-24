/** Starting a video or sound can be refused, and some browsers answer with nothing at all, so neither
 *  outcome is treated as a failure: what matters is that the element is asked. */
export const playNow = (element: HTMLMediaElement): void => {
  void Promise.resolve(element.play?.()).catch(() => {})
}
