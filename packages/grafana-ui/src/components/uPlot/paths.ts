import uPlot, { Series } from 'uplot';

export const barsBuilder: Series.PathBuilder = (
  u: uPlot,
  seriesIdx: number,
  idx0: number,
  idx1: number,
  extendGap: Series.ExtendGap,
  buildClip: Series.BuildClip
) => {
  const series = u.series[seriesIdx];
  const xdata = u.data[0];
  const ydata = u.data[seriesIdx];
  const scaleX = u.series[0].scale as string;
  const scaleY = series.scale as string;

  const gapFactor = 0.25;

  let gap = (u.width * gapFactor) / (idx1 - idx0);
  let maxWidth = Infinity;

  //@ts-ignore
  let fillTo = series.fillTo(u, seriesIdx, series.min, series.max);

  let y0Pos = u.valToPos(fillTo, scaleY, true);
  let colWid = u.bbox.width / (idx1 - idx0);

  let strokeWidth = Math.round(series.width! * devicePixelRatio);

  let barWid = Math.round(Math.min(maxWidth, colWid - gap) - strokeWidth);

  let stroke = new Path2D();

  for (let i = idx0; i <= idx1; i++) {
    let yVal = ydata[i];

    if (yVal == null) {
      continue;
    }

    let xVal = u.scales.x.distr === 2 ? i : xdata[i];

    // TODO: all xPos can be pre-computed once for all series in aligned set
    let xPos = u.valToPos(xVal, scaleX, true);
    let yPos = u.valToPos(yVal, scaleY, true);

    let lft = Math.round(xPos - barWid / 2);
    let btm = Math.round(Math.max(yPos, y0Pos));
    let top = Math.round(Math.min(yPos, y0Pos));
    let barHgt = btm - top;

    stroke.rect(lft, top, barWid, barHgt);
  }

  let fill = series.fill != null ? new Path2D(stroke) : undefined;

  return {
    stroke,
    fill,
  };
};

/*
const enum StepSide {
  Before,
  After,
}
*/

export const stepBeforeBuilder = stepBuilderFactory(false);
export const stepAfterBuilder = stepBuilderFactory(true);

// babel does not support inlined const enums, so this uses a boolean flag for perf
// possible workaround: https://github.com/dosentmatter/babel-plugin-const-enum
function stepBuilderFactory(after: boolean): Series.PathBuilder {
  return (
    u: uPlot,
    seriesIdx: number,
    idx0: number,
    idx1: number,
    extendGap: Series.ExtendGap,
    buildClip: Series.BuildClip
  ) => {
    const series = u.series[seriesIdx];
    const xdata = u.data[0];
    const ydata = u.data[seriesIdx];
    const scaleX = u.series[0].scale as string;
    const scaleY = series.scale as string;
    const halfStroke = series.width! / 2;

    const stroke = new Path2D();

    // find first non-null dataPt
    while (ydata[idx0] == null) {
      idx0++;
    }

    // find last-null dataPt
    while (ydata[idx1] == null) {
      idx1--;
    }

    let gaps: Series.Gaps = [];
    let inGap = false;
    let prevYPos = Math.round(u.valToPos(ydata[idx0]!, scaleY, true));
    let firstXPos = Math.round(u.valToPos(xdata[idx0], scaleX, true));
    let prevXPos = firstXPos;

    stroke.moveTo(firstXPos, prevYPos);

    for (let i = idx0 + 1; i <= idx1; i++) {
      let yVal1 = ydata[i];

      let x1 = Math.round(u.valToPos(xdata[i], scaleX, true));

      if (yVal1 == null) {
        //@ts-ignore
        if (series.isGap(u, seriesIdx, i)) {
          extendGap(gaps, prevXPos, x1);
          inGap = true;
        }

        continue;
      }

      let y1 = Math.round(u.valToPos(yVal1, scaleY, true));

      if (inGap) {
        extendGap(gaps, prevXPos, x1);

        // don't clip vertical extenders
        if (prevYPos !== y1) {
          let lastGap = gaps[gaps.length - 1];
          lastGap[0] += halfStroke;
          lastGap[1] -= halfStroke;
        }

        inGap = false;
      }

      if (after) {
        stroke.lineTo(x1, prevYPos);
      } else {
        stroke.lineTo(prevXPos, y1);
      }

      stroke.lineTo(x1, y1);

      prevYPos = y1;
      prevXPos = x1;
    }

    const fill = new Path2D(stroke);

    //@ts-ignore
    let fillTo = series.fillTo(u, seriesIdx, series.min, series.max);

    let minY = Math.round(u.valToPos(fillTo, scaleY, true));

    fill.lineTo(prevXPos, minY);
    fill.lineTo(firstXPos, minY);

    let clip = !series.spanGaps ? buildClip(gaps) : null;

    return {
      stroke,
      fill,
      clip,
    };
  };
}

// adapted from https://gist.github.com/nicholaswmin/c2661eb11cad5671d816 (MIT)
/**
 * Interpolates a Catmull-Rom Spline through a series of x/y points
 * Converts the CR Spline to Cubic Beziers for use with SVG items
 *
 * If 'alpha' is 0.5 then the 'Centripetal' variant is used
 * If 'alpha' is 1 then the 'Chordal' variant is used
 *
 *
 * @param  {Array} data - Array of points, each point in object literal holding x/y values
 * @return {String} d - SVG string with cubic bezier curves representing the Catmull-Rom Spline
 */
function catmullRomFitting(xCoords: number[], yCoords: number[], alpha: number) {
  const path = new Path2D();

  const dataLen = xCoords.length;

  let p0x,
    p0y,
    p1x,
    p1y,
    p2x,
    p2y,
    p3x,
    p3y,
    bp1x,
    bp1y,
    bp2x,
    bp2y,
    d1,
    d2,
    d3,
    A,
    B,
    N,
    M,
    d3powA,
    d2powA,
    d3pow2A,
    d2pow2A,
    d1pow2A,
    d1powA;

  path.moveTo(Math.round(xCoords[0]), Math.round(yCoords[0]));

  for (let i = 0; i < dataLen - 1; i++) {
    let p0i = i === 0 ? 0 : i - 1;

    p0x = xCoords[p0i];
    p0y = yCoords[p0i];

    p1x = xCoords[i];
    p1y = yCoords[i];

    p2x = xCoords[i + 1];
    p2y = yCoords[i + 1];

    if (i + 2 < dataLen) {
      p3x = xCoords[i + 2];
      p3y = yCoords[i + 2];
    } else {
      p3x = p2x;
      p3y = p2y;
    }

    d1 = Math.sqrt(Math.pow(p0x - p1x, 2) + Math.pow(p0y - p1y, 2));
    d2 = Math.sqrt(Math.pow(p1x - p2x, 2) + Math.pow(p1y - p2y, 2));
    d3 = Math.sqrt(Math.pow(p2x - p3x, 2) + Math.pow(p2y - p3y, 2));

    // Catmull-Rom to Cubic Bezier conversion matrix

    // A = 2d1^2a + 3d1^a * d2^a + d3^2a
    // B = 2d3^2a + 3d3^a * d2^a + d2^2a

    // [   0             1            0          0          ]
    // [   -d2^2a /N     A/N          d1^2a /N   0          ]
    // [   0             d3^2a /M     B/M        -d2^2a /M  ]
    // [   0             0            1          0          ]

    d3powA = Math.pow(d3, alpha);
    d3pow2A = Math.pow(d3, 2 * alpha);
    d2powA = Math.pow(d2, alpha);
    d2pow2A = Math.pow(d2, 2 * alpha);
    d1powA = Math.pow(d1, alpha);
    d1pow2A = Math.pow(d1, 2 * alpha);

    A = 2 * d1pow2A + 3 * d1powA * d2powA + d2pow2A;
    B = 2 * d3pow2A + 3 * d3powA * d2powA + d2pow2A;
    N = 3 * d1powA * (d1powA + d2powA);

    if (N > 0) {
      N = 1 / N;
    }

    M = 3 * d3powA * (d3powA + d2powA);

    if (M > 0) {
      M = 1 / M;
    }

    bp1x = (-d2pow2A * p0x + A * p1x + d1pow2A * p2x) * N;
    bp1y = (-d2pow2A * p0y + A * p1y + d1pow2A * p2y) * N;

    bp2x = (d3pow2A * p1x + B * p2x - d2pow2A * p3x) * M;
    bp2y = (d3pow2A * p1y + B * p2y - d2pow2A * p3y) * M;

    if (bp1x === 0 && bp1y === 0) {
      bp1x = p1x;
      bp1y = p1y;
    }

    if (bp2x === 0 && bp2y === 0) {
      bp2x = p2x;
      bp2y = p2y;
    }

    path.bezierCurveTo(bp1x, bp1y, bp2x, bp2y, p2x, p2y);
  }

  return path;
}

export const smoothBuilder: Series.PathBuilder = (
  u: uPlot,
  seriesIdx: number,
  idx0: number,
  idx1: number,
  extendGap: Series.ExtendGap,
  buildClip: Series.BuildClip
) => {
  const series = u.series[seriesIdx];
  const xdata = u.data[0];
  const ydata = u.data[seriesIdx];
  const scaleX = u.series[0].scale as string;
  const scaleY = series.scale as string;

  // find first non-null dataPt
  while (ydata[idx0] == null) {
    idx0++;
  }

  // find last-null dataPt
  while (ydata[idx1] == null) {
    idx1--;
  }

  let gaps: Series.Gaps = [];
  let inGap = false;
  let firstXPos = Math.round(u.valToPos(xdata[idx0], scaleX, true));
  let prevXPos = firstXPos;

  let xCoords = [];
  let yCoords = [];

  for (let i = idx0; i <= idx1; i++) {
    let yVal = ydata[i];
    let xVal = xdata[i];
    let xPos = u.valToPos(xVal, scaleX, true);

    if (yVal == null) {
      //@ts-ignore
      if (series.isGap(u, seriesIdx, i)) {
        extendGap(gaps, prevXPos + 1, xPos);
        inGap = true;
      }

      continue;
    } else {
      if (inGap) {
        extendGap(gaps, prevXPos + 1, xPos + 1);
        inGap = false;
      }

      xCoords.push((prevXPos = xPos));
      yCoords.push(u.valToPos(ydata[i]!, scaleY, true));
    }
  }

  const stroke = catmullRomFitting(xCoords, yCoords, 0.5);

  const fill = new Path2D(stroke);

  //@ts-ignore
  let fillTo = series.fillTo(u, seriesIdx, series.min, series.max);

  let minY = Math.round(u.valToPos(fillTo, scaleY, true));

  fill.lineTo(prevXPos, minY);
  fill.lineTo(firstXPos, minY);

  let clip = !series.spanGaps ? buildClip(gaps) : null;

  return {
    stroke,
    fill,
    clip,
  };
};
