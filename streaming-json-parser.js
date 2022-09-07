

// a TSV parser that parses the data incrementally in chunks
const jsonChunkedParser = () => {
  const textDecoder = new TextDecoder("utf-8");
  let previousChunk = ""
  return {
    parseChunk(chunk) {
      // decode and split into lines
      const textData = previousChunk+textDecoder.decode(chunk);
      let start = 0, end = 0
      textData.includes('[{')?start = 1 : start= 0
      const lines = textData.slice(textData.includes('[{')?1 : 0,textData.lastIndexOf('},')+1)
      previousChunk = textData.slice(textData.lastIndexOf('},')+2,textData.length)

      const items = JSON.parse('['+lines+']')

      return items;
    }
  };
};


onmessage = async ({ data: filename }) => {
  let totalBytes = 0;

  const jsonParser = jsonChunkedParser();
  const response = await fetch(filename);

  if (!response.body) {
    throw Error("ReadableStream not yet supported in this browser.");
  }

  const streamedResponse = new Response(
    new ReadableStream({
      start(controller) {
        const reader = response.body.getReader();

        const read = async () => {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          const items = jsonParser.parseChunk(value);

          totalBytes += value.byteLength;
          postMessage({ items, totalBytes });

          controller.enqueue(value);
          read();
        };

        read();
      }
    })
  );

  const data = await streamedResponse.text();

  postMessage({ items: [], totalBytes: data.length, finished: true });
};
