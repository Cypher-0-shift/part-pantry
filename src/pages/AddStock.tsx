import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const AddStock = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [formData, setFormData] = useState({
    hsnCode: "",
    partName: "",
    brand: "",
    category: "",
    carCompany: "",
    carModel: "",
    carName: "",
    buyingPrice: "",
    sellingPrice: "",
    sgst: "",
    cgst: "",
    quantity: "",
    lowStockThreshold: "5",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from("part-images")
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("part-images")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: "Image upload failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const generateHSNCode = async () => {
    const { data, error } = await supabase
      .from("stock")
      .select("hsn_code")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return "HSN-001";
    }

    const lastCode = data[0].hsn_code;
    const match = lastCode.match(/HSN-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1]) + 1;
      return `HSN-${String(nextNum).padStart(3, "0")}`;
    }

    return "HSN-001";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      let hsnCode = formData.hsnCode;
      if (!hsnCode) {
        hsnCode = await generateHSNCode();
      }

      const { error } = await supabase.from("stock").insert({
        user_id: user.id,
        hsn_code: hsnCode,
        part_name: formData.partName,
        brand: formData.brand,
        category: formData.category,
        car_company: formData.carCompany || null,
        car_model: formData.carModel || null,
        car_name: formData.carName || null,
        buying_price: parseFloat(formData.buyingPrice),
        selling_price: parseFloat(formData.sellingPrice),
        price: parseFloat(formData.sellingPrice), // Keep for backward compatibility
        sgst_percentage: parseFloat(formData.sgst) || 0,
        cgst_percentage: parseFloat(formData.cgst) || 0,
        quantity: parseInt(formData.quantity),
        low_stock_threshold: parseInt(formData.lowStockThreshold),
        image_url: imageUrl,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Stock added successfully",
      });

      navigate("/parts");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Add New Stock</CardTitle>
            <CardDescription>Add a new spare part to your inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hsnCode">
                    HSN Code <span className="text-muted-foreground text-xs">(optional - auto-generated)</span>
                  </Label>
                  <Input
                    id="hsnCode"
                    name="hsnCode"
                    placeholder="HSN-001"
                    value={formData.hsnCode}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partName">Part Name *</Label>
                  <Input
                    id="partName"
                    name="partName"
                    placeholder="Brake Pad"
                    value={formData.partName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand">Brand *</Label>
                  <Input
                    id="brand"
                    name="brand"
                    placeholder="Toyota"
                    value={formData.brand}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Input
                    id="category"
                    name="category"
                    placeholder="Brakes"
                    value={formData.category}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carCompany">Car Company</Label>
                  <Input
                    id="carCompany"
                    name="carCompany"
                    placeholder="Toyota"
                    value={formData.carCompany}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carModel">Car Model</Label>
                  <Input
                    id="carModel"
                    name="carModel"
                    placeholder="Camry"
                    value={formData.carModel}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carName">Car Name</Label>
                  <Input
                    id="carName"
                    name="carName"
                    placeholder="2024 Camry LE"
                    value={formData.carName}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buyingPrice">Buying Price (₹) *</Label>
                  <Input
                    id="buyingPrice"
                    name="buyingPrice"
                    type="number"
                    step="0.01"
                    placeholder="1200.00"
                    value={formData.buyingPrice}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sellingPrice">Selling Price (₹) *</Label>
                  <Input
                    id="sellingPrice"
                    name="sellingPrice"
                    type="number"
                    step="0.01"
                    placeholder="1500.00"
                    value={formData.sellingPrice}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sgst">SGST % *</Label>
                  <Input
                    id="sgst"
                    name="sgst"
                    type="number"
                    step="0.01"
                    placeholder="9"
                    value={formData.sgst}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cgst">CGST % *</Label>
                  <Input
                    id="cgst"
                    name="cgst"
                    type="number"
                    step="0.01"
                    placeholder="9"
                    value={formData.cgst}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    placeholder="10"
                    value={formData.quantity}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lowStockThreshold">Low Stock Alert Threshold</Label>
                  <Input
                    id="lowStockThreshold"
                    name="lowStockThreshold"
                    type="number"
                    placeholder="5"
                    value={formData.lowStockThreshold}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Part Image</Label>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="flex-1"
                    />
                    {uploading && <Loader2 className="w-5 h-5 animate-spin" />}
                  </div>
                  {imagePreview && (
                    <div className="relative w-full max-w-xs">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="rounded-lg border w-full h-48 object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="flex-1" disabled={loading || uploading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Stock"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/parts")}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddStock;
