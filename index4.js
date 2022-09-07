let data = [];
let stripChartData =[]
let nested = []
let chartShowIds = []
let xScale, yScale, xScaleOriginal, yScaleOriginal
const container = document.querySelector('d3fc-canvas');

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

const zeroLine = fc
    .seriesWebglLine()
    .crossValue((d) => d.track)
    .mainValue((d) => 0)
    .decorate((program, data) => {
        fc.webglStrokeColor()
            .value([1,0,0,0.1])
            .data(data)(program);
    });
const lines = [
  line,
  line1,
  line2,
  line3]
const series = fc
    .seriesWebglMulti()
    .series([
        line,
        point, 
        zeroLine,
    ])
    .mapping((data, index, series) => {
        // console.log(data,index,series);
        switch (series[index]) {
            case point:
                return data.trackball;
            default:
                return data.values;
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
  .on("zoom", () => {
    // update the scales based on current zoom
    xScale.domain(d3.event.transform.rescaleX(xScaleOriginal).domain());
    yScale.domain(d3.event.transform.rescaleY(yScaleOriginal).domain());
    // renderGl();
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
// const renderGl = (t) => {
//     showFPS(t)
//     // chartShowIds.forEach((n,i)=>{
//         d3.select('#chart'+0)
//             .datum(nested)
//             .call(chart[0])
//             // .classed('tooltip', (d) => d.trackball.length)
//     // });
//     // requestAnimationFrame(renderGl);
// }

let pixels = null;
let frame = 0;
let gl = null;




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
    for (var i=0; i<6; i++)
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

      xScale = d3.scaleLinear().domain(xExtent(nested[0].values.slice(0,nested[1].values.length/100)));
      yScale = d3.scaleLinear().domain(yExtent(nested[0].values));
      xScaleOriginal = xScale.copy();
      yScaleOriginal = yScale.copy();

      d3.select(container)
      .on('measure', event => {
          console.log(event);
          const { width, height } = event.detail;
          xScale.range([0, width]);
          yScale.range([height, 0]);
  
          gl = container.querySelector('canvas').getContext('webgl');
          series.context(gl);
      })
      .on('draw', () => {
          if (pixels == null) {
              pixels = new Uint8Array(
                  gl.drawingBufferWidth * gl.drawingBufferHeight * 4
              );
          }
          performance.mark(`draw-start-${frame}`);
          series(nested[0]);
          // Force GPU to complete rendering to allow accurate performance measurements to be taken
          gl.readPixels(
              0,
              0,
              gl.drawingBufferWidth,
              gl.drawingBufferHeight,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels
          );
          performance.measure(`draw-duration-${frame}`, `draw-start-${frame}`);
          frame++;
      });
  
  container.requestRedraw();
  }

};
streamingLoaderWorker.postMessage("geometry_data.json");

