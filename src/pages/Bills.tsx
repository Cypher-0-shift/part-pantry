import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Trash2, ShoppingCart, DollarSign } from "lucide-react";
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

    const existingItem = orderItems.find((item) => item.stock_id === selectedStock);
    if (existingItem) {
      setOrderItems(
        orderItems.map((item) =>
          item.stock_id === selectedStock
            ? {
                ...item,
                quantity: item.quantity + itemQuantity,
                subtotal: (item.quantity + itemQuantity) * item.price,
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
          price: Number(stockItem.price),
          subtotal: itemQuantity * Number(stockItem.price),
        },
      ]);
    }

    setSelectedStock("");
    setItemQuantity(1);
  };

  const removeItemFromOrder = (stock_id: string) => {
    setOrderItems(orderItems.filter((item) => item.stock_id !== stock_id));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.subtotal, 0);
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

    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: selectedCustomer,
        total_amount: total,
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
    fetchData();
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

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Add Items</h3>
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
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} × ₹{item.price} = ₹{item.subtotal}
                          </p>
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
                    <div className="border-t pt-2 mt-2">
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
