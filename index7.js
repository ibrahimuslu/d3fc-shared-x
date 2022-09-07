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

  if (finished) {
    console.log(data);
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
let lineSeries = []
const color = d3.scaleOrdinal(d3.schemeCategory10);

for(let i =0; i<10; i++){
  lineSeries.push(
    fc
    .seriesWebglLine()
    .equals((a, b) => a === b)
    // .size(1)
    .crossValue(d => d.x)
    .mainValue(d => d.data[i])
    .decorate((program, _, index) => {
        fc
            .webglStrokeColor()
            .value(() => {
                // const { r, g, b, opacity } = d3.color(color(i));
                return [i*10 / 255, i*10 / 255, 10 / 255, 1];
            })
            .data(data)(program);
    })
  
  );
}
 

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

const pointer = (index) => fc.pointer().on("point", ([coord]) => {
  annotations[index].pop();

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
    annotations[index].push(createAnnotationData(closestDatum));
  }

//   requestAnimationFrame(redraw);
});
const thresh = fc
        .annotationSvgLine()
        .orient('horizontal')
        .decorate((selection) => {
            // console.log(selection.node());            
            selection
                .enter()
                .select('.left-handle')
                .append('text');
            selection
                .select('.left-handle text')
                .style('fill', 'red').text((d)=>d?d:0).attr('font-size','0.5em').attr('x','100');
            selection
            .select('line')
                .style('stroke', 'red')
        })
const annotationSeries = seriesSvgAnnotation()
  .notePadding(15)
  .type(d3.annotationCallout);

const chart = (index) => fc
  .chartCartesian(xScale, yScale)
  .webglPlotArea(
    // only render the point series on the WebGL layer
    fc
      .seriesWebglMulti()
      .series([lineSeries[index]])
      .mapping(d => d.data)
  )
  .svgPlotArea(
    // only render the annotations series on the SVG layer
    fc
      .seriesSvgMulti()
      .series([
        annotationSeries,
        fc.annotationSvgGridline(),
        thresh
      ])
      // .mapping(d => d.annotations[index])
      .mapping((data, index, series) => {
        switch (series[index]) {
            case thresh:
                return [0.3];
            case annotationSeries:
                return data.annotations[index]
        }
    })
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
      .call(pointer(index))
  );

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
const redraw = (t) => {
  showFPS(t)
  for(let c=0;c<10;c++){
    annotations[c]=[]
    d3.select("#chart"+c).datum({ annotations, data }).call(chart(c));
    
  }

  requestAnimationFrame(redraw);

};
requestAnimationFrame(redraw);
