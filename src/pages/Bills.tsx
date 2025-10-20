import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Trash2, ShoppingCart, DollarSign, Download, Share2, Mail, MessageCircle, Edit2, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateBillPDF } from "@/lib/pdf-generator";

interface Customer {
  id: string;
  customer_id: string;
  name: string;
}

interface StockItem {
  id: string;
  hsn_code: string;
  part_name: string;
  brand: string;
  buying_price: number;
  selling_price: number;
  price: number;
  sgst_percentage: number;
  cgst_percentage: number;
  quantity: number;
}

interface OrderItem {
  stock_id: string;
  part_name: string;
  quantity: number;
  price: number;
  buying_price: number;
  selling_price: number;
  sgst_percentage: number;
  cgst_percentage: number;
  sgst_amount: number;
  cgst_amount: number;
  total_gst: number;
  subtotal: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  total_amount: number;
  created_at: string;
  customers: {
    name: string;
    customer_id: string;
  };
}

const Bills = () => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedStock, setSelectedStock] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [includeGST, setIncludeGST] = useState(true);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCustomers(), fetchStock(), fetchOrders()]);
    setLoading(false);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, customer_id, name")
      .order("created_at", { ascending: false });
    setCustomers(data || []);
  };

  const fetchStock = async () => {
    const { data } = await supabase
      .from("stock")
      .select("*")
      .gt("quantity", 0)
      .order("part_name");
    setStock(data || []);
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select(`
        *,
        customers(name, customer_id)
      `)
      .order("created_at", { ascending: false });
    setOrders(data || []);
  };

  const generateOrderNumber = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "ORD-001";

    const { data } = await supabase
      .from("orders")
      .select("order_number")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].order_number.split("-")[1]) + 1;
      return `ORD-${lastNum.toString().padStart(3, "0")}`;
    }
    return "ORD-001";
  };

  const addItemToOrder = () => {
    const stockItem = stock.find((s) => s.id === selectedStock);
    if (!stockItem) {
      toast({
        title: "Error",
        description: "Please select a part",
        variant: "destructive",
      });
      return;
    }

    if (itemQuantity <= 0 || itemQuantity > stockItem.quantity) {
      toast({
        title: "Error",
        description: `Invalid quantity. Available: ${stockItem.quantity}`,
        variant: "destructive",
      });
      return;
    }

    const basePrice = Number(stockItem.selling_price);
    const sgstAmount = (basePrice * Number(stockItem.sgst_percentage)) / 100;
    const cgstAmount = (basePrice * Number(stockItem.cgst_percentage)) / 100;
    const totalGst = sgstAmount + cgstAmount;
    const priceWithGst = basePrice + totalGst;

    const existingItem = orderItems.find((item) => item.stock_id === selectedStock);
    if (existingItem) {
      const newQty = existingItem.quantity + itemQuantity;
      const newSgst = sgstAmount * newQty;
      const newCgst = cgstAmount * newQty;
      const newTotalGst = newSgst + newCgst;
      const newSubtotal = includeGST ? priceWithGst * newQty : basePrice * newQty;

      setOrderItems(
        orderItems.map((item) =>
          item.stock_id === selectedStock
            ? {
                ...item,
                quantity: newQty,
                sgst_amount: newSgst,
                cgst_amount: newCgst,
                total_gst: newTotalGst,
                subtotal: newSubtotal,
              }
            : item
        )
      );
    } else {
      setOrderItems([
        ...orderItems,
        {
          stock_id: stockItem.id,
          part_name: `${stockItem.part_name} (${stockItem.brand})`,
          quantity: itemQuantity,
          price: includeGST ? priceWithGst : basePrice,
          buying_price: Number(stockItem.buying_price),
          selling_price: basePrice,
          sgst_percentage: Number(stockItem.sgst_percentage),
          cgst_percentage: Number(stockItem.cgst_percentage),
          sgst_amount: sgstAmount * itemQuantity,
          cgst_amount: cgstAmount * itemQuantity,
          total_gst: totalGst * itemQuantity,
          subtotal: includeGST ? priceWithGst * itemQuantity : basePrice * itemQuantity,
        },
      ]);
    }

    setSelectedStock("");
    setItemQuantity(1);
  };

  const removeItemFromOrder = (stock_id: string) => {
    setOrderItems(orderItems.filter((item) => item.stock_id !== stock_id));
  };

  const updateItemPrice = (stock_id: string, newPrice: number) => {
    setOrderItems(
      orderItems.map((item) => {
        if (item.stock_id === stock_id) {
          const sgstAmount = (newPrice * item.sgst_percentage) / 100;
          const cgstAmount = (newPrice * item.cgst_percentage) / 100;
          const totalGst = sgstAmount + cgstAmount;
          const priceWithGst = includeGST ? newPrice + totalGst : newPrice;
          
          return {
            ...item,
            selling_price: newPrice,
            price: priceWithGst,
            sgst_amount: sgstAmount * item.quantity,
            cgst_amount: cgstAmount * item.quantity,
            total_gst: totalGst * item.quantity,
            subtotal: priceWithGst * item.quantity,
          };
        }
        return item;
      })
    );
    setEditingItemId(null);
    setEditPrice("");
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const calculateTotalGST = () => {
    return orderItems.reduce((sum, item) => sum + item.total_gst, 0);
  };

  const calculateTotalBuyingPrice = () => {
    return orderItems.reduce((sum, item) => sum + item.buying_price * item.quantity, 0);
  };

  const calculateTotalSellingPrice = () => {
    return orderItems.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);
  };

  const calculateProfit = () => {
    return calculateTotalSellingPrice() - calculateTotalBuyingPrice();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    if (orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const orderNumber = await generateOrderNumber();
    const total = calculateTotal();
    const totalBuying = calculateTotalBuyingPrice();
    const totalSelling = calculateTotalSellingPrice();
    const profit = calculateProfit();

    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: selectedCustomer,
        total_amount: total,
        total_buying_price: totalBuying,
        total_selling_price: totalSelling,
        profit_amount: profit,
        user_id: user.id,
      })
      .select()
      .single();

    if (orderError) {
      toast({
        title: "Error",
        description: orderError.message,
        variant: "destructive",
      });
      return;
    }

    // Insert order items
    const { error: itemsError } = await supabase.from("order_items").insert(
      orderItems.map((item) => ({
        order_id: orderData.id,
        stock_id: item.stock_id,
        part_name: item.part_name,
        quantity: item.quantity,
        price: item.price,
        buying_price: item.buying_price,
        selling_price: item.selling_price,
        sgst_amount: item.sgst_amount,
        cgst_amount: item.cgst_amount,
        total_gst: item.total_gst,
        subtotal: item.subtotal,
      }))
    );

    if (itemsError) {
      toast({
        title: "Error",
        description: itemsError.message,
        variant: "destructive",
      });
      return;
    }

    // Update stock quantities
    for (const item of orderItems) {
      const stockItem = stock.find((s) => s.id === item.stock_id);
      if (stockItem) {
        await supabase
          .from("stock")
          .update({ quantity: stockItem.quantity - item.quantity })
          .eq("id", item.stock_id);
      }
    }

    toast({
      title: "Success",
      description: `Bill ${orderNumber} created successfully`,
    });

    setSelectedCustomer("");
    setOrderItems([]);
    setOpen(false);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    fetchData();
  };

  const shareViaWhatsApp = (order: Order) => {
    const message = `Invoice: ${order.order_number}%0ACustomer: ${order.customers?.name}%0AAmount: ₹${Number(order.total_amount).toFixed(2)}%0ADate: ${new Date(order.created_at).toLocaleDateString("en-IN")}`;
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const shareViaEmail = (order: Order) => {
    const subject = `Invoice ${order.order_number}`;
    const body = `Dear ${order.customers?.name},%0A%0APlease find your invoice details below:%0A%0AInvoice Number: ${order.order_number}%0AAmount: ₹${Number(order.total_amount).toFixed(2)}%0ADate: ${new Date(order.created_at).toLocaleDateString("en-IN")}%0A%0AThank you for your business!`;
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Bills & Orders
            </h1>
            <p className="text-muted-foreground">Create and manage customer bills</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg hover:shadow-xl transition-all">
                <Plus className="w-4 h-4" />
                Create Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Bill</DialogTitle>
                <DialogDescription>Add items and generate a bill</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Customer *</Label>
                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.customer_id} - {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Invoice Date *</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                  />
                </div>
                </div>

                 <div className="border-t pt-4">
                   <div className="flex items-center justify-between mb-3">
                     <h3 className="font-semibold">Add Items</h3>
                     <div className="flex items-center gap-2">
                       <Label htmlFor="gst-toggle" className="text-sm">Include GST</Label>
                       <Switch
                         id="gst-toggle"
                         checked={includeGST}
                         onCheckedChange={setIncludeGST}
                       />
                     </div>
                   </div>
                   <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Label>Select Part</Label>
                      <Select value={selectedStock} onValueChange={setSelectedStock}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a part" />
                        </SelectTrigger>
                        <SelectContent>
                          {stock.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.part_name} ({item.brand}) - ₹{item.price} - Qty: {item.quantity}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                        />
                        <Button type="button" onClick={addItemToOrder} size="icon">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {orderItems.length > 0 && (
                  <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
                    <h3 className="font-semibold">Order Items</h3>
                    {orderItems.map((item) => (
                      <div
                        key={item.stock_id}
                        className="flex items-center justify-between p-2 bg-card rounded"
                      >
                         <div className="flex-1">
                           <p className="font-medium">{item.part_name}</p>
                           {editingItemId === item.stock_id ? (
                             <div className="flex items-center gap-2 mt-1">
                               <Input
                                 type="number"
                                 step="0.01"
                                 value={editPrice}
                                 onChange={(e) => setEditPrice(e.target.value)}
                                 className="w-24 h-8"
                                 placeholder="New rate"
                               />
                               <Button
                                 type="button"
                                 size="sm"
                                 onClick={() => updateItemPrice(item.stock_id, parseFloat(editPrice))}
                               >
                                 <Check className="w-3 h-3" />
                               </Button>
                               <Button
                                 type="button"
                                 size="sm"
                                 variant="ghost"
                                 onClick={() => {
                                   setEditingItemId(null);
                                   setEditPrice("");
                                 }}
                               >
                                 <X className="w-3 h-3" />
                               </Button>
                             </div>
                           ) : (
                             <p className="text-sm text-muted-foreground">
                               {item.quantity} × ₹{item.selling_price.toFixed(2)} = ₹{item.subtotal.toFixed(2)}
                               <Button
                                 type="button"
                                 variant="ghost"
                                 size="sm"
                                 className="ml-2 h-6 px-2"
                                 onClick={() => {
                                   setEditingItemId(item.stock_id);
                                   setEditPrice(item.selling_price.toString());
                                 }}
                               >
                                 <Edit2 className="w-3 h-3" />
                               </Button>
                             </p>
                           )}
                           {includeGST && (
                             <p className="text-xs text-muted-foreground">
                               GST: ₹{item.total_gst.toFixed(2)} (SGST: ₹{item.sgst_amount.toFixed(2)}, CGST: ₹{item.cgst_amount.toFixed(2)})
                             </p>
                           )}
                         </div>
                         <Button
                           type="button"
                           variant="ghost"
                           size="sm"
                           onClick={() => removeItemFromOrder(item.stock_id)}
                         >
                           <Trash2 className="w-4 h-4 text-destructive" />
                         </Button>
                      </div>
                    ))}
                     <div className="border-t pt-2 mt-2 space-y-1">
                       {includeGST && (
                         <p className="text-sm text-muted-foreground text-right">
                           Total GST: ₹{calculateTotalGST().toFixed(2)}
                         </p>
                       )}
                       <p className="text-lg font-bold text-right">
                         Total: ₹{calculateTotal().toFixed(2)}
                       </p>
                     </div>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={orderItems.length === 0}>
                  Create Bill
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No bills yet</h3>
              <p className="text-muted-foreground mb-4">Create your first bill</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <Card
                key={order.id}
                className="hover:shadow-xl transition-all hover:scale-105 duration-300 border-2"
              >
                 <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
                   <CardTitle className="flex items-start justify-between">
                     <div>
                       <div className="flex items-center gap-2 mb-1">
                         <ShoppingCart className="w-5 h-5" />
                         <span className="font-bold">{order.order_number}</span>
                       </div>
                       <p className="text-sm font-normal text-muted-foreground">
                         {order.customers?.customer_id}
                       </p>
                       <p className="text-base font-semibold">{order.customers?.name}</p>
                     </div>
                     <div className="flex gap-1">
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => generateBillPDF(order.id)}
                       >
                         <Download className="w-4 h-4" />
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => shareViaWhatsApp(order)}
                       >
                         <MessageCircle className="w-4 h-4" />
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => shareViaEmail(order)}
                       >
                         <Mail className="w-4 h-4" />
                       </Button>
                     </div>
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="pt-4">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-accent/20 to-secondary/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-accent" />
                      <span className="font-semibold">Total:</span>
                    </div>
                    <span className="text-xl font-bold text-accent">
                      ₹{Number(order.total_amount).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {new Date(order.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Bills;
