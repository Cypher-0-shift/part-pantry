import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, Edit, Trash2, Plus, PackagePlus } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UpdateStockDialog from "@/components/UpdateStockDialog";

interface Part {
  id: string;
  hsn_code: string;
  part_name: string;
  brand: string;
  category: string;
  buying_price: number;
  selling_price: number;
  price: number;
  sgst_percentage: number;
  cgst_percentage: number;
  quantity: number;
  low_stock_threshold: number;
  image_url: string | null;
  car_company: string | null;
  car_model: string | null;
  car_name: string | null;
}

const Parts = () => {
  const { toast } = useToast();
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [updateStockPart, setUpdateStockPart] = useState<Part | null>(null);
  
  // Filter states
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [selectedCar, setSelectedCar] = useState<string>("all");

  // Get unique values for filters
  const companies = Array.from(new Set(parts.map(p => p.car_company).filter(Boolean))) as string[];
  const models = Array.from(new Set(parts.filter(p => selectedCompany === "all" || p.car_company === selectedCompany).map(p => p.car_model).filter(Boolean))) as string[];
  const cars = Array.from(new Set(parts.filter(p => (selectedCompany === "all" || p.car_company === selectedCompany) && (selectedModel === "all" || p.car_model === selectedModel)).map(p => p.car_name).filter(Boolean))) as string[];

  useEffect(() => {
    fetchParts();
  }, []);

  useEffect(() => {
    const filtered = parts.filter((part) => {
      const matchesSearch =
        part.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.hsn_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCompany = selectedCompany === "all" || part.car_company === selectedCompany;
      const matchesModel = selectedModel === "all" || part.car_model === selectedModel;
      const matchesCar = selectedCar === "all" || part.car_name === selectedCar;
      
      return matchesSearch && matchesCompany && matchesModel && matchesCar;
    });
    setFilteredParts(filtered);
  }, [searchTerm, parts, selectedCompany, selectedModel, selectedCar]);

  const fetchParts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stock")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setParts(data || []);
      setFilteredParts(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from("stock").delete().eq("id", deleteId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Part deleted successfully",
      });
      fetchParts();
    }
    setDeleteId(null);
  };

  const handleUpdateStock = async (partId: string, newQuantity: number) => {
    const { error } = await supabase
      .from("stock")
      .update({ quantity: newQuantity })
      .eq("id", partId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Stock quantity updated successfully",
      });
      fetchParts();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Parts Inventory</h1>
            <p className="text-muted-foreground">
              Manage your spare parts stock
            </p>
          </div>
          <Link to="/add-stock">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Stock
            </Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, brand, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Select value={selectedCompany} onValueChange={(value) => {
                  setSelectedCompany(value);
                  setSelectedModel("all");
                  setSelectedCar("all");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company} value={company}>
                        {company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={selectedModel} onValueChange={(value) => {
                  setSelectedModel(value);
                  setSelectedCar("all");
                }} disabled={selectedCompany === "all"}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models</SelectItem>
                    {models.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={selectedCar} onValueChange={setSelectedCar} disabled={selectedModel === "all"}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Cars" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cars</SelectItem>
                    {cars.map((car) => (
                      <SelectItem key={car} value={car}>
                        {car}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading parts...</p>
          </div>
        ) : filteredParts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No parts found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Start by adding your first part"}
              </p>
              {!searchTerm && (
                <Link to="/add-stock">
                  <Button>Add Your First Part</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredParts.map((part) => (
              <Card key={part.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {part.image_url && (
                  <div className="h-32 bg-muted overflow-hidden">
                    <img
                      src={part.image_url}
                      alt={part.part_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate mb-1">{part.part_name}</h3>
                      <p className="text-xs text-muted-foreground">{part.brand}</p>
                    </div>
                    <Badge variant={part.quantity <= part.low_stock_threshold ? "destructive" : "secondary"} className="text-xs">
                      {part.quantity <= part.low_stock_threshold ? "Low" : "Stock"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">HSN:</span>
                      <span className="font-medium">{part.hsn_code}</span>
                    </div>
                    {part.car_company && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Car:</span>
                        <span className="font-medium">{part.car_company} {part.car_model}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Buy/Sell:</span>
                      <span className="font-medium">₹{part.buying_price.toFixed(2)} / ₹{part.selling_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Qty:</span>
                      <span className={`font-medium ${part.quantity <= part.low_stock_threshold ? 'text-destructive' : ''}`}>
                        {part.quantity}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 text-xs h-8"
                      onClick={() => setUpdateStockPart(part)}
                    >
                      <PackagePlus className="w-3 h-3" />
                      Update
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
                      <Edit className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(part.id)}
                      className="gap-1 text-xs h-8"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the part from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {updateStockPart && (
        <UpdateStockDialog
          open={!!updateStockPart}
          onOpenChange={(open) => !open && setUpdateStockPart(null)}
          partName={updateStockPart.part_name}
          currentQuantity={updateStockPart.quantity}
          onUpdate={(newQuantity) => handleUpdateStock(updateStockPart.id, newQuantity)}
        />
      )}
    </div>
  );
};

export default Parts;
