import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface UdhaariRecord {
  id: string;
  amount: number;
  paid_amount: number;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  customers: {
    name: string;
    phone: string | null;
  };
}

interface Customer {
  id: string;
  name: string;
}

const Udhaari = () => {
  const { toast } = useToast();
  const [records, setRecords] = useState<UdhaariRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    customerId: "",
    amount: "",
    description: "",
    dueDate: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch udhaari records with customer info
    const { data: udhaariData, error: udhaariError } = await supabase
      .from("udhaari")
      .select(`
        *,
        customers (
          name,
          phone
        )
      `)
      .order("created_at", { ascending: false });

    if (udhaariError) {
      toast({
        title: "Error",
        description: udhaariError.message,
        variant: "destructive",
      });
    } else {
      setRecords(udhaariData || []);
    }

    // Fetch customers for dropdown
    const { data: customersData } = await supabase
      .from("customers")
      .select("id, name")
      .order("name");

    if (customersData) {
      setCustomers(customersData);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("udhaari").insert({
      user_id: user.id,
      customer_id: formData.customerId,
      amount: parseFloat(formData.amount),
      description: formData.description || null,
      due_date: formData.dueDate || null,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Udhaari record added successfully",
      });
      setFormData({ customerId: "", amount: "", description: "", dueDate: "" });
      setOpen(false);
      fetchData();
    }
  };

  const handlePayment = async (id: string, currentPaid: number, totalAmount: number) => {
    const paymentAmount = prompt("Enter payment amount:");
    if (!paymentAmount) return;

    const newPaidAmount = currentPaid + parseFloat(paymentAmount);
    const newStatus = newPaidAmount >= totalAmount ? "paid" : "partial";

    const { error } = await supabase
      .from("udhaari")
      .update({ paid_amount: newPaidAmount, status: newStatus })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });
      fetchData();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "destructive" | "secondary" | "default"> = {
      pending: "destructive",
      partial: "secondary",
      paid: "default",
    };
    return <Badge variant={variants[status] || "secondary"}>{status.toUpperCase()}</Badge>;
  };

  const calculateTotals = () => {
    const total = records.reduce((sum, record) => sum + record.amount, 0);
    const paid = records.reduce((sum, record) => sum + record.paid_amount, 0);
    const pending = total - paid;
    return { total, paid, pending };
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Udhaari (Credit) Records</h1>
            <p className="text-muted-foreground">Track pending payments from customers</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Udhaari
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Udhaari Record</DialogTitle>
                <DialogDescription>Record a new credit transaction</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer *</Label>
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (Rs) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Parts purchased, service details..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">Add Udhaari</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                <p className="text-2xl font-bold">Rs {totals.total.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Paid Amount</p>
                <p className="text-2xl font-bold text-green-600">Rs {totals.paid.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Pending Amount</p>
                <p className="text-2xl font-bold text-destructive">Rs {totals.pending.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading records...</p>
          </div>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No udhaari records yet</h3>
              <p className="text-muted-foreground mb-4">Start tracking customer credits</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <Card key={record.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg mb-1">{record.customers.name}</h3>
                      {record.customers.phone && (
                        <p className="text-sm text-muted-foreground">{record.customers.phone}</p>
                      )}
                    </div>
                    {getStatusBadge(record.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="font-semibold">Rs {record.amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Paid</p>
                      <p className="font-semibold text-green-600">Rs {record.paid_amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className="font-semibold text-destructive">
                        Rs {(record.amount - record.paid_amount).toFixed(2)}
                      </p>
                    </div>
                    {record.due_date && (
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due Date
                        </p>
                        <p className="font-semibold">{new Date(record.due_date).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>

                  {record.description && (
                    <p className="text-sm text-muted-foreground mb-4">{record.description}</p>
                  )}

                  {record.status !== "paid" && (
                    <Button
                      size="sm"
                      onClick={() => handlePayment(record.id, record.paid_amount, record.amount)}
                    >
                      Record Payment
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Udhaari;
