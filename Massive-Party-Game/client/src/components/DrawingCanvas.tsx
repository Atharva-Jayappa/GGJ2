import { useRef, useState, useEffect } from "react";
import { Eraser, Pen, RotateCcw } from "lucide-react";

interface DrawingCanvasProps {
  onSave: (base64: string) => void;
}

export function DrawingCanvas({ onSave }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set dimensions based on parent width but keep ratio
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = 300;
    }

    const context = canvas.getContext("2d");
    if (context) {
      context.strokeStyle = "black";
      context.lineWidth = 3;
      context.lineCap = "round";
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      setCtx(context);
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const pos = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); 
    if (!isDrawing || !ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    if (!ctx || !canvasRef.current) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onSave(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="relative border-4 border-dashed border-gray-300 rounded-xl overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="bg-white w-full cursor-crosshair touch-none"
        />
        <div className="absolute top-2 right-2 bg-black/10 px-2 py-1 rounded text-xs text-black font-bold pointer-events-none">
          DRAW YOURSELF
        </div>
      </div>
      
      <button
        type="button"
        onClick={clear}
        className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gray-200 text-gray-800 font-bold hover:bg-gray-300 transition-colors w-full"
      >
        <RotateCcw className="w-4 h-4" /> CLEAR CANVAS
      </button>
    </div>
  );
}
