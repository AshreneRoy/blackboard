/*global chrome*/
import React from 'react';
import { Stage, Layer, Line } from 'react-konva';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import Toolbox from './components/Toolbox/Toolbox';
import TextBox from './components/TextBox/TextBox';

const CanvasMain = styled.div`
  position: absolute;
  top: 0px;
  right: 0px;
  left: 0px;
  z-index: 2147483647;
  background:none transparent;
  margin: 0;
  padding: 0;
  box-shadow: 0px 0px 0px 3px limegreen inset;
`;

const Canvas = () => {

  const [tool, setTool] = React.useState('pen');
  const [lines, setLines] = React.useState([]);
  const [textBoxes, setTextBoxes] = React.useState([]);
  const [strokeWidth,setStrokeWidth] = React.useState(4);
  const [colourValue, setColourValue] = React.useState("#df4b26");

  const undoStack = React.useRef([]);
  const redoStack = React.useRef([]);
  const isStageListening = React.useRef(true);
  const isDrawing = React.useRef(false);
  const colorRef = React.useRef();
  const textBoxRef = React.useRef();
  const lineRef = React.useRef();
  lineRef.current = lines;
  textBoxRef.current = textBoxes;
  colorRef.current = colourValue;

  let originalFixedTopElements = new Set();
  let originalFixedBottomElements = new Set();
  let canvas = document.createElement('canvas');

  const memoTextBoxEvent = React.useCallback((e) => {
    let originalTextbox = textBoxRef.current;
      const textbox = {
        top: window.scrollY + e.clientY,
        left: e.clientX,
        color: colorRef.current,
        id: `blackboard-${uuidv4()}`
      }
      originalTextbox.push(textbox);
      _push_to_stack('create_textbox',textbox);
      setTextBoxes(originalTextbox.concat());
  }, []);

  React.useEffect(() => {
    if(tool === 'textbox') {
      isStageListening.current = false;
      window.addEventListener('dblclick', memoTextBoxEvent, true);
    } else {
      isStageListening.current = true;
      window.removeEventListener('dblclick', memoTextBoxEvent, true);
    }
  },[tool])

  // Line drawing events
  const handleMouseDown = (e) => {
    if(!isStageListening.current) {
      return;
    }
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { action: 'draw', tool: {name: tool, strokeWidth: strokeWidth, colour: colourValue}, points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e) => {
    // no drawing - skipping
    if(!isStageListening.current) {
      return;
    }
    if (!isDrawing.current) {
      return;
    }
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let newLine = lines;
    let size = lines.length - 1;
    let lastLine = lines[size];
    // add point
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    newLine[size] = lastLine;
    setLines(newLine.concat());
  };

  const handleMouseUp = () => {
    if(!isStageListening.current) {
      return;
    }
    _push_to_stack('create_line', lineRef.current[lineRef.current.length - 1]);
    isDrawing.current = false;
  };

  // Screenshot event
  const handleCapture = () => {
    let app = document.getElementById('blackboard-canvas-1234');
    let top = app.getBoundingClientRect().top + window.pageYOffset;
    let height = app.getBoundingClientRect().height;
    _prepare();
    
    let n = (height / (window.innerHeight - 80));
    let screenshots = [];
    canvas.width = window.innerWidth;
    canvas.height = height;
    let context = canvas.getContext('2d');
    for (let i = 0; i<n; i++) {
      screenshots[i] = {
        scrollTo: top,
      };
      top = top + window.innerHeight - 80; // To handle sticky/fixed headers
    }

    capture(0,n, screenshots, context);
    
  };


  const capture = (j,n,screenshots,context) => {
    let isComplete = (j-n <= 1 && j-n >= 0) ? true : false;
    if (!isComplete) window.scrollTo({top: screenshots[j].scrollTo});
    _getAllFixedElements();
    window.setTimeout(() => {
      if(!isComplete) {
        chrome.runtime.sendMessage({message: 'capture_screenshot'}, (captured) => {
          let dY = window.scrollY;
          _getAllFixedElements();
          let image = new Image();
          image.onload = () => {
            context.globalCompositeOperation='destination-over';
            context.drawImage(image, 0, dY, window.innerWidth, window.innerHeight);
          };
          image.src = captured;
          let k = j + 1;
          capture(k,n,screenshots,context);
        });
				
      } else {
        chrome.runtime.sendMessage({message: 'save', image: canvas.toDataURL('image/png')}, () => {
          _cleanup();
        });
      }	
    }, 400);
  };

  const _cleanup = () => {
    for(let item of originalFixedTopElements) { 
      item.element.style.position = item.style;
    }
    for(let item of originalFixedBottomElements) { 
      item.element.style.display = item.style;
    }
    let toolbox = document.getElementById('blackboard-canvas-1234-toolbox');
    toolbox.style.display = 'flex';
    let app = document.getElementById('blackboard-canvas-1234');
    app.style.boxShadow = '0px 0px 0px 3px limegreen inset';
  };
  
  const _getAllFixedElements = () => {
    let elems = document.body.getElementsByTagName('*');
    let length = elems.length;
    for(let i = 0; i < length; i++) { 
      let elemStyle = window.getComputedStyle(elems[i]);
      if(elemStyle.getPropertyValue('position') === 'fixed' || elemStyle.getPropertyValue('position') === 'sticky' ) { 
        if(elems[i].getBoundingClientRect().top < window.innerHeight/2) {
          const originalStylePosition = elemStyle.getPropertyValue('position');
          elems[i].style.position = 'absolute';
          originalFixedTopElements.add({style: originalStylePosition, element: elems[i]});
        } else {
          const originalStyleDisplay = elemStyle.getPropertyValue('display');
          elems[i].style.display = 'none';
          originalFixedBottomElements.add({style: originalStyleDisplay, element: elems[i]});
        }
          
      } 
    }
  };

  const _prepare = () => {
    let toolbox = document.getElementById('blackboard-canvas-1234-toolbox');
    let app = document.getElementById('blackboard-canvas-1234');
    toolbox.style.display = 'none';
    app.style.boxShadow = 'none';
  }

  const handlePencilOption = (width) => {
    setStrokeWidth(width);
  }

  const handleColourPalette = (colour) => {
    setColourValue(colour);
  }

  // Erase all event
  const handleReset = () => {
    _push_to_stack('reset', {lines, textBoxes});
    setLines([]);
    setTextBoxes([]);

  }

  const handleUndo = () => {
    if(undoStack.current.length > 0) {
      const event = undoStack.current.pop();
      alert(JSON.stringify(event))
      if(event.action === 'create_line') {
        let originalLines = lines;
        originalLines.pop();
        setLines(originalLines.concat());
      }
      if(event.action === 'create_textbox') {
        let originalTextboxes = textBoxes;
        originalTextboxes.pop();
        setTextBoxes(originalTextboxes.concat());
      }
      if(event.action === 'delete_textbox') {
        let originalTextboxes = textBoxes;
        originalTextboxes.push(event.data);
        setTextBoxes(originalTextboxes.concat());
      }
      if(event.action === 'reset') {
        setLines(event.data.lines.concat());
        setTextBoxes(event.data.textBoxes.concat());
      }
      redoStack.current.push(event);
    }
  }

  const handleRedo = () => {
    if(redoStack.current.length > 0) {
      const event = redoStack.current.pop();
      alert(JSON.stringify(event))
      if(event.action === 'create_line') {
        let originalLines = lines;
        originalLines.push(event.data);
        setLines(originalLines.concat());
      }
      if(event.action === 'create_textbox') {
        let originalTextboxes = textBoxes;
        originalTextboxes.push(event.data);
        setTextBoxes(originalTextboxes.concat());
      }
      if(event.action === 'delete_textbox') {
        let originalTextboxes = textBoxes;
        originalTextboxes.pop();
        setTextBoxes(originalTextboxes.concat());
      }
      if(event.action === 'reset') {
        setLines([].concat());
        setTextBoxes([].concat());
      }
      undoStack.current.push(event);
    }
  }

  // Textbox events
  const handleTextboxDelete = (id) => {
    let updatedTextboxList = textBoxes.filter((textbox) => {
      if(textbox.id === id) {
        _push_to_stack('delete_textbox',textbox);
        return false;
      }
      return true;
    });
   
    setTextBoxes(updatedTextboxList);
  }
  
  const handleTextChange = (id, text) => {
    let updatedTextboxList = textBoxes.map((textbox) => {
      if(textbox.id === id) {
        textbox.text = text;
      }
      return textbox;
    })
    setTextBoxes(updatedTextboxList);
  }

  const calculateHeight = () => {
    const bodyHeight = document.documentElement.scrollHeight;
    // use heightRef instead of height inside window eventlistener of useEffect : https://stackoverflow.com/questions/56511176/state-being-reset
    // MAX canvas length in chrome and firefox is around 32767 pixels
    if (bodyHeight < 8000) {
      return bodyHeight - 5; // Subtract few pixels to avoid extending body length
    }
    return 8000;
  };

  const _push_to_stack = (action, data) => {
    undoStack.current.push({
      action,
      data,
    });
    redoStack.current = [];
  }

  return (
    <CanvasMain id="blackboard-canvas-1234">
        <Stage
          width={window.innerWidth}
          height={calculateHeight()}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.tool.colour}
                strokeWidth={line.tool.strokeWidth}
                tension={0.5}
                lineCap="round"
                globalCompositeOperation={
                  line.tool.name === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
        <Toolbox
          handleSetTool={(tool) => {
            setTool(tool);
          }}
          handleCapture={handleCapture}
          handlePencilOption={handlePencilOption}
          handleColourPalette={handleColourPalette}
          handleReset={handleReset}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          strokeWidth={strokeWidth}
          colourValue={colourValue}
        ></Toolbox>
        {
          textBoxes.map((textbox) => (
            <TextBox 
              id={textbox.id}
              key={textbox.id}
              top={textbox.top}
              left={textbox.left}
              color={textbox.color}
              text={textbox.text}
              disabled={!isStageListening.current}
              handleTextboxDelete={() => handleTextboxDelete(textbox.id)}
              handleTextChange={handleTextChange}
            />
          ))
        }
    </CanvasMain>
  );
};

export default Canvas;
