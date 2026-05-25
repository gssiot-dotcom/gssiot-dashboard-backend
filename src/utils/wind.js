exports.degToCompass = (deg) => {
  if (typeof deg !== 'number' || isNaN(deg)) return undefined
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  const ix = Math.round(deg / 22.5) % 16
  return dirs[ix]
}
