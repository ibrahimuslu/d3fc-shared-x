import { seriesSvgAnnotation } from "./annotation-series.js";
import {
  distance,
  trunc,
  hashCode,
  webglColor,
  iterateElements
} from "./util.js";

let data = [],mata=[];
let quadtree;
let quadmap = new Map()
let xScale, xScaleOriginal 
let yScale=[], yScaleOriginal=[]
const yExtent = fc.extentLinear([-2,2])

const xExtent = fc.extentLinear().accessors([(v) => v.scaled_loc]);

const createAnnotationData = datapoint => ({
  note: {
    label: datapoint.scaled_loc + " " + datapoint.y,
    bgPadding: 5,
    title: trunc(datapoint.run_id, 100)
  },
  x: datapoint.x,
  y: datapoint.y,
  dx: 20,
  dy: datapoint.y<0?-20:20
});

// create a web worker that streams the chart data
const streamingLoaderWorker = new Worker("streaming-json-parser.js");
streamingLoaderWorker.onmessage = ({
  data: { items, totalBytes, finished }
}) => {
  const rows = items
    .map(d => { 
        const dn = {
            ...d,
            x: Number(d.scaled_loc),
            y: Number(d.data[0])
        }
        quadmap.set(d.scaled_loc,dn)
        return dn
    })
    .filter(d => d.scaled_loc);
  mata = mata.concat(rows);

  if (finished) {
    // console.log(data);
    
    data = mata.slice(0,mata.findIndex(d=> d.scaled_loc == mata[0].scaled_loc+2))
    document.getElementById("loading").style.display = "none";

    // create a spatial index for rapidly finding the closest datapoint    
    quadtree = d3
      .quadtree()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(data);
    xScale = d3.scaleLinear().domain([xExtent(data)[0],xExtent(data)[0]+1]);
    xScaleOriginal = xScale.copy();
    for(let m =0; m< data[0].data.length;m++){
        yScale[m] = d3.scaleLinear().domain(yExtent(data.map(d=> d.data[m])));
        yScaleOriginal[m] = yScale[m].copy(); 
    }
    requestAnimationFrame(redraw);

  }

};
streamingLoaderWorker.postMessage("geometry_data.json");

// const languageColorScale = d3.scaleOrdinal(d3.schemeCategory10);
// const yearColorScale = d3
//   .scaleSequential()
//   .domain([1850, 2000])
//   .interpolator(d3.interpolateRdYlGn);
const lineSeries = []
const color = d3.scaleOrdinal(d3.schemeCategory10);

for(let idx =0; idx<27; idx++){
 lineSeries 
//   = (idx) => 
  .push(
    fc
    .seriesWebglLine()
    .equals((a, b) => a === b)
    // .size(1)
    .crossValue(d => d.x)
    .mainValue(d => d.data[idx])
    .decorate((program, _, index) => {
        fc
            .webglStrokeColor()
            .value(() => {
                // const { r, g, b, opacity } = d3.color(color(i));
                return [idx*10 / 255, idx*10 / 255, 10 / 255, 1];
            })
            .data(_)(program);
    })
  
  );
}
 
let count = 0
const zoom = (index) => d3
  .zoom()
  .scaleExtent([1, 1000])
  .on("zoom", (event) => {
    // update the scales based on current zoom
    
    xScale.domain(event.transform.rescaleX(xScaleOriginal).domain());
    // yScale[index].domain(event.transform.rescaleY(yScaleOriginal[index]).domain());
    // requestAnimationFrame(redraw);
  })

const annotations = [];

const pointer = (index) => fc.pointer().on("point", ([coord]) => {
    console.log(coord)
//   annotations[index].pop();

  if (!coord || !quadmap) {
    return;
  }

  // find the closes datapoint to the pointer
  const x = //Math.round(
    xScale.invert(coord.x)
    // *10000)/10000;
    //   const y = yScale[index].invert(coord.y);
    //   const radius = Math.abs(xScale.invert(coord.x) - xScale.invert(coord.x - 50));
    //   const closestDatum = quadtree.find(x, y, radius);
  const closestDatum = quadmap.get(x)
//   console.log(coord, x,closestDatum, quadmap);
  // if the closest point is within 20 pixels, show the annotation
  if (closestDatum) {
    annotations[index].push(createAnnotationData(closestDatum));  
    // requestAnimationFrame(redraw);

  }

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

const chart = (idx) => fc
  .chartCartesian(xScale, yScale[idx])
  .webglPlotArea(
    // only render the point series on the WebGL layer
    fc
      .seriesWebglMulti()
      .series([lineSeries[idx]])
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
    //   .mapping(d => d.annotations[index])
      .mapping((data, index, series) => {
        switch (series[index]) {
            case thresh:
                return [0.3];
            case annotationSeries:
                return data.annotations[idx]
        }
    })
  )
  .decorate(sel =>
    sel
      .enter()
      .select("d3fc-svg.plot-area")
      .on("measure.range", (event) => {
        xScaleOriginal.range([0, event.detail.width]);
        yScaleOriginal[idx].range([event.detail.height, 0]);
      })
    //   .on('click', () => {
    //       const domain = yScale[idx].domain();
    //       const max = Math.round(domain[1] / 0.5);
    //       const min = Math.round(domain[0] / 0.5);
    //       yScale[idx].domain([min, max]);
    //   }).on('contextmenu', (event) => {
    //     event.preventDefault();
    //     const domain = yScale[idx].domain();
    //     const max = Math.round(domain[1] / 2);
    //     const min = Math.round(domain[0] / 2);
    //     yScale[idx].domain([min, max]);
    // })
      .call(zoom(idx))
      .call(pointer(idx))
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
  for(let c=0;c<27;c++){
    annotations[c]=[]
    d3.select("#chart"+c).datum({ annotations, data }).call(chart(c));
  }

  requestAnimationFrame(redraw);

};