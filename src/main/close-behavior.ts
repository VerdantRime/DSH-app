export function shouldHideToTray(closeToTray: boolean, isQuitting: boolean): boolean {
  return closeToTray && !isQuitting
}
