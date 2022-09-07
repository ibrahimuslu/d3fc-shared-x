import { seriesSvgAnnotation } from "./annotation-series.js";
import {
  distance,
  trunc,
  hashCode,
  webglColor,
  iterateElements
} from "./util.js";

let data = [];
let stripChartData =[]
let quadtree;
let nested = []
let selectedRange = [0,0]
let navChartIdx = 0 // index of chart selected for navigation
let chartShowIds = []
let xScale, yScale, xScaleOriginal, yScaleOriginal
let chartData = { 
  series: nested[navChartIdx],
  brushedRange: [0, 0.2]
}
const xExtent = fc.extentLinear()
.accessors([(v) => v.track])
const yExtent = fc.extentLinear()
.accessors([(y) => y.n])


const line = fc
    .seriesWebglLine()
    .crossValue((d) => d.track)
    .mainValue((d) => d.n)
    .decorate((program, data) => {
        fc.webglStrokeColor()
            .value([0,1,0,1])
            .data(data)(program);
    });

    const line1 = fc
    .seriesWebglLine()
    .crossValue((d) => d.track)
    .mainValue((d) => d.n)
    .decorate((program, data) => {
        fc.webglStrokeColor()
            .value([1,0,0,1])
            .data(data)(program);
    });

    const line2 = fc
    .seriesWebglLine()
    .crossValue((d) => d.track)
    .mainValue((d) => d.n)
    .decorate((program, data) => {
        fc.webglStrokeColor()
            .value([0,0,1,1])
            .data(data)(program);
    });

    const line3 = fc
    .seriesWebglLine()
    .crossValue((d) => d.track)
    .mainValue((d) => d.n)
    .decorate((program, data) => {
        fc.webglStrokeColor()
            .value([0,0,1,0.5])
            .data(data)(program);
    });
    
const greenFill = (d) => [0 / 255, 255 / 255, 0 / 255, 100]
const fillColor = fc.webglFillColor().value(greenFill).data(data);

const point = fc
    .seriesWebglPoint()  
    .size(25)
    .crossValue((d) => d.track)
    .mainValue((d) => d.value)
    .decorate((program, data) => {
        fc.webglFillColor()
            .value([1,0,0,1])
            .data(data)(program);
    });


const brush = fc.brushX().on('brush', (e) => {
    // if the brush has zero height there is no selection
    if (e.selection) {
        
        chartData.brushedRange = e.selection;
        
        selectedRange[0] = e.xDomain[0].toFixed(3);
        selectedRange[1] = e.xDomain[1].toFixed(3);
        chart[navChartIdx].xDomain(e.xDomain);
        

        renderGl()
    }
});
const multiN = fc
    .seriesSvgMulti()
    .series([brush])
    .mapping((data, index, series) => {
        switch (series[index]) {
            case brush:
                return data.brushedRange;
            default:
                return data.series.values
        }
    });
const zeroLine = fc
    .seriesWebglLine()
    .crossValue((d) => d.track)
    .mainValue((d) => 0)
    .decorate((program, data) => {
        fc.webglStrokeColor()
            .value([1,0,0,0.1])
            .data(data)(program);
    });

const multi = fc
    .seriesWebglMulti()
    .series([
        line,
        line,
        line,
        line1,
        line2,
        line3,
        point, 
        zeroLine,
    ])
    .mapping((data, index, series) => {
        // console.log(data,index,series);
        switch (series[index]) {
            case point:
                return data[0].trackball;
            default:
                return data[index].values;
        }
    });



    const width = 820;
    const height = 384;
const zoom = d3
  .zoom()
  .extent([
    [0, 0],
    [width, height]
  ])
  .scaleExtent([0.1, 100])
  .translateExtent([
    [0, 0],
    [width, height]
  ])
  .on("zoom", (event) => {
    // update the scales based on current zoom
    xScale.domain(event.transform.rescaleX(xScaleOriginal).domain());
    yScale.domain(event.transform.rescaleY(yScaleOriginal).domain());
    // renderGl();
    requestAnimationFrame(renderGl);

    // renderSvg()
  });
// anpointer component that is added to the plot-area, re-rendering
// each time the event fires.
const pointer = fc.pointer().on('point', (event) => {
    const coord = event[0]
    // console.log(event[0]);

            if (!coord ) {
                return;
            }
        const track = Math.round(xScale.invert(coord.x)*10000)/10000;
        document.getElementById('pointedValue').innerHTML=((data[0].get(track)??'0')+" "+track)

            chartShowIds.forEach(groupIdx => {
                    nested[groupIdx].trackball = [
                        {
                            track: track,
                            value: data[groupIdx].get(track)
                        }
                    ];
                
            });           

        // renderGl();
        requestAnimationFrame(renderGl);


});

// charts list for all charts
let chart = []

let lastTime = 0;
const times = [];
let it = 0;

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
let navigatorChart
const renderGl = (t) => {
    showFPS(t)
    // chartShowIds.forEach((n,i)=>{
        d3.select('#chart'+1)
            .datum(nested)
            .call(chart[0])
            // .classed('tooltip', (d) => d.trackball.length)
    // });
    requestAnimationFrame(renderGl);
}
console.log('ok');
const renderSvg = () => {
    d3.select('#navigator-chart')
        .datum(chartData)
        .call(navigatorChart);
}

const aBlock = document.createElement('block').appendChild(document.createElement('strong'));
document.getElementById("loading").firstChild.appendChild(aBlock);
// create a web worker that streams the chart data
const streamingLoaderWorker = new Worker("streaming-json-parser.js");
streamingLoaderWorker.onmessage = ({
  data: { items, totalBytes, finished }
}) => {

  stripChartData = stripChartData.concat(items);
  aBlock.innerHTML=(totalBytes/1024/1024).toFixed(2)+' Mb'

  if (finished) {
    document.getElementById("loading").style.display = "none";
    nested = []
    chartShowIds = []
    for (var i=0; i<10; i++)
        { 
            let values = new Array()
            data[i] = new Map()
            stripChartData.forEach((scd,j) => {
                data[i].set(scd.scaled_loc, scd.data[i])
                values.push({'track':scd.scaled_loc,'n':scd.data[i]})
            })

            nested.push(  {'key':i,'values': values,'trackball' : [],'thresh':0.3, show: true})
            chartShowIds.push(i);
        }
        
    
                
    chart = []
    chartShowIds.forEach((nIdx,i) =>{ // list charts according to the sorted order

      xScale = d3.scaleLinear().domain(xExtent(nested[1].values));
      yScale = d3.scaleLinear().domain(yExtent(nested[1].values));
      xScaleOriginal = xScale.copy();
      yScaleOriginal = yScale.copy();
        chart[0] =
        // chart.push(
            fc
            .chartCartesian(xScale, yScale)
            .yLabel((d) => d.key)
            .yTicks(3)
            .xTicks(20)
            .xTickFormat(d3.format('0'))
            .yOrient('left')
            .webglPlotArea(multi)
            .decorate((sel) => {
                sel
                .enter()
                .select('#chart0 .plot-area')
                .on("measure.range", (event) => {
                  xScaleOriginal.range([0, event.detail.width]);
                  yScaleOriginal.range([event.detail.height, 0]);
                })
                .call(zoom)
                .call(pointer)
            })
        // )
    });
    requestAnimationFrame(renderGl);
          
  }

};
streamingLoaderWorker.postMessage("geometry_data.json");

