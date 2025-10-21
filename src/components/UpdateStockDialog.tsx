import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";

interface UpdateStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partName: string;
  currentQuantity: number;
  onUpdate: (newQuantity: number) => Promise<void>;
}

const UpdateStockDialog = ({
  open,
  onOpenChange,
  partName,
  currentQuantity,
  onUpdate,
}: UpdateStockDialogProps) => {
  const [quantity, setQuantity] = useState(currentQuantity);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    await onUpdate(quantity);
    setLoading(false);
    onOpenChange(false);
  };

  const increment = () => setQuantity((prev) => prev + 1);
  const decrement = () => setQuantity((prev) => Math.max(0, prev - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Stock Quantity</DialogTitle>
          <DialogDescription>
            Adjust the stock quantity for {partName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Quantity: {currentQuantity}</Label>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={decrement}
              disabled={quantity <= 0}
            >
              <Minus className="w-4 h-4" />
            </Button>
            
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              className="text-center text-lg font-semibold"
              min="0"
            />
            
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={increment}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {quantity > currentQuantity && (
              <p className="text-green-600">+{quantity - currentQuantity} items will be added</p>
            )}
            {quantity < currentQuantity && (
              <p className="text-red-600">-{currentQuantity - quantity} items will be removed</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={loading}>
            {loading ? "Updating..." : "Update Stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateStockDialog;
