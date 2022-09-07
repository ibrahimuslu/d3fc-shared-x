import { seriesSvgAnnotation } from "./annotation-series.js";
import {
  distance,
  trunc,
  hashCode,
  webglColor,
  iterateElements
} from "./util.js";

let data = [];
let quadtree;

let data1 = [];
let quadtree1;
const createAnnotationData = datapoint => ({
  note: {
    label: datapoint.scaled_loc + " " + datapoint.y,
    bgPadding: 5,
    title: trunc(datapoint.run_id, 100)
  },
  x: datapoint.x,
  y: datapoint.y,
  dx: 20,
  dy: 20
});

// create a web worker that streams the chart data
const streamingLoaderWorker = new Worker("streaming-json-parser.js");
streamingLoaderWorker.onmessage = ({
  data: { items, totalBytes, finished }
}) => {
  const rows = items
    .map(d => ({
      ...d,
      x: Number(d.scaled_loc),
      y: Number(d.data[0])
    }))
    .filter(d => d.scaled_loc);
  data = data.concat(rows);
  const rows1 = items
    .map(d => ({
      ...d,
      x: Number(d.scaled_loc),
      y: Number(d.data[1])
    }))
    .filter(d => d.scaled_loc);
  data1 = data1.concat(rows1);

  if (finished) {
    document.getElementById("loading").style.display = "none";

    // compute the fill color for each datapoint
    // const languageFill = d =>
    //   webglColor(languageColorScale(hashCode(d.id) % 10));

    // const fillColor = fc.webglStrokeColor().value(languageFill).data(data);
    // pointSeries.decorate(program => fillColor(program));

    // wire up the fill color selector
    // iterateElements(".controls a", el => {
    //   el.addEventListener("click", () => {
    //     iterateElements(".controls a", el2 => el2.classList.remove("active"));
    //     el.classList.add("active");
    //     fillColor.value(el.id === "language" ? languageFill : yearFill);
    //     // requestAnimationFrame(redraw);
    //   });
    // });

    // create a spatial index for rapidly finding the closest datapoint
    quadtree = d3
      .quadtree()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(data);
      quadtree1 = d3
        .quadtree()
        .x(d => d.x)
        .y(d => d.y)
        .addAll(data1);
  }

};
streamingLoaderWorker.postMessage("geometry_data.json");

// const languageColorScale = d3.scaleOrdinal(d3.schemeCategory10);
// const yearColorScale = d3
//   .scaleSequential()
//   .domain([1850, 2000])
//   .interpolator(d3.interpolateRdYlGn);
const xScale = d3.scaleLinear().domain([644, 645]);
const yScale = d3.scaleLinear().domain([-10, 10]);
const xScaleOriginal = xScale.copy();
const yScaleOriginal = yScale.copy();

const pointSeries = fc
  .seriesWebglLine()
  .equals((a, b) => a === b)
  // .size(1)
  .crossValue(d => d.x)
  .mainValue(d => d.y);

const zoom = d3
  .zoom()
  .scaleExtent([0.8, 10])
  .on("zoom", (event) => {
    // update the scales based on current zoom
    xScale.domain(event.transform.rescaleX(xScaleOriginal).domain());
    // yScale.domain(event.transform.rescaleY(yScaleOriginal).domain());
    // requestAnimationFrame(redraw);
  })

const annotations = [];

const pointer = fc.pointer().on("point", ([coord]) => {
  annotations.pop();

  if (!coord || !quadtree) {
    return;
  }

  // find the closes datapoint to the pointer
  const x = xScale.invert(coord.x);
  const y = yScale.invert(coord.y);
  const radius = Math.abs(xScale.invert(coord.x) - xScale.invert(coord.x - 20));
  const closestDatum = quadtree.find(x, y, radius);

  // if the closest point is within 20 pixels, show the annotation
  if (closestDatum) {
    annotations[0] = createAnnotationData(closestDatum);
  }

//   requestAnimationFrame(redraw);
});

const annotationSeries = seriesSvgAnnotation()
  .notePadding(15)
  .type(d3.annotationCallout);

  let lastTime = 0;
  const times = [];
  let it = 0;
// render the chart with the required data
// Enqueues a redraw to occur on the next animation frame
const showFPS = (t) => {
  const dt = t - lastTime;
  lastTime = t;
  times.push(dt);
  it++;
  if (times.length > 10) times.splice(0, 1);
  if (it > 10) {
    it = 0;
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    d3.select('#fps').text(`fps: ${Math.floor(1000 / avg)}`);
  }
};

const chart = fc
  .chartCartesian(xScale, yScale)
  .webglPlotArea(
    // only render the point series on the WebGL layer
    fc
      .seriesWebglMulti()
      .series([pointSeries])
      .mapping(d => d.data)
  )
  .svgPlotArea(
    // only render the annotations series on the SVG layer
    fc
      .seriesSvgMulti()
      .series([annotationSeries,
        fc.annotationSvgGridline()])
      .mapping(d => d.annotations)
      
  )
  .decorate(sel =>
    sel
      .enter()
      .select("d3fc-svg.plot-area")
      .on("measure.range", (event) => {
        xScaleOriginal.range([0, event.detail.width]);
        yScaleOriginal.range([event.detail.height, 0]);
      })
      .on('click', () => {
          const domain = yScale.domain();
          const max = Math.round(domain[1] / 0.5);
          const min = Math.round(domain[0] / 0.5);
          yScale.domain([min, max]);
      }).on('contextmenu', (event) => {
        event.preventDefault();
        const domain = yScale.domain();
        const max = Math.round(domain[1] / 2);
        const min = Math.round(domain[0] / 2);
        yScale.domain([min, max]);
    })
      .call(zoom)
      .call(pointer)
  );

const redraw = (t) => {
  showFPS(t)
  d3.select("#chart").datum({ annotations, data }).call(chart);
  requestAnimationFrame(redraw);

};
requestAnimationFrame(redraw);

const chart1 = fc
  .chartCartesian(xScale, yScale)
  .webglPlotArea(
    // only render the point series on the WebGL layer
    fc
      .seriesWebglMulti()
      .series([pointSeries])
      .mapping(d => d.data1)
  )
  .svgPlotArea(
    // only render the annotations series on the SVG layer
    fc
      .seriesSvgMulti()
      .series([annotationSeries,
        fc.annotationSvgGridline()])
      .mapping(d => d.annotations)
      
  )
  .decorate(sel =>
    sel
      .enter()
      .select("d3fc-svg.plot-area")
      .on("measure.range", (event) => {
        xScaleOriginal.range([0, event.detail.width]);
        yScaleOriginal.range([event.detail.height, 0]);
      })
      .on('click', () => {
          const domain = yScale.domain();
          const max = Math.round(domain[1] / 0.5);
          const min = Math.round(domain[0] / 0.5);
          yScale.domain([min, max]);
      }).on('contextmenu', (event) => {
        event.preventDefault();
        const domain = yScale.domain();
        const max = Math.round(domain[1] / 2);
        const min = Math.round(domain[0] / 2);
        yScale.domain([min, max]);
    })
      .call(zoom)
      .call(pointer)
  );

const redraw1 = (t) => {
  showFPS(t)
  d3.select("#chart1").datum({ annotations, data1 }).call(chart1);
  requestAnimationFrame(redraw1);

};
requestAnimationFrame(redraw1);