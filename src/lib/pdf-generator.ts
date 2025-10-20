import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

export const generateBillPDF = async (orderId: string) => {
  try {
    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        customers(name, customer_id, address, phone, email)
      `)
      .eq("id", orderId)
      .single();

    if (orderError) throw orderError;

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (itemsError) throw itemsError;

    // Fetch business settings
    const { data: { user } } = await supabase.auth.getUser();
    const { data: businessSettings } = await supabase
      .from("business_settings")
      .select("*")
      .eq("user_id", user?.id)
      .single();

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header - Business Info
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(businessSettings?.business_name || "Vijaya Auto Spares", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (businessSettings?.address) {
      doc.text(businessSettings.address, pageWidth / 2, 28, { align: "center" });
    }
    
    let yPos = 34;
    if (businessSettings?.contact_phone || businessSettings?.contact_email) {
      const contactInfo = [
        businessSettings?.contact_phone,
        businessSettings?.contact_email
      ].filter(Boolean).join(" | ");
      doc.text(contactInfo, pageWidth / 2, yPos, { align: "center" });
      yPos += 6;
    }
    
    if (businessSettings?.gstin) {
      doc.text(`GSTIN: ${businessSettings.gstin}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 6;
    }

    // Invoice Details
    yPos += 4;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 8;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Bill details and customer details side by side
    const leftColX = 14;
    const rightColX = pageWidth / 2 + 10;
    
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", leftColX, yPos);
    doc.text("Invoice Details:", rightColX, yPos);
    yPos += 6;
    
    doc.setFont("helvetica", "normal");
    doc.text(order.customers?.name || "N/A", leftColX, yPos);
    doc.text(`Invoice #: ${order.order_number}`, rightColX, yPos);
    yPos += 5;
    
    if (order.customers?.customer_id) {
      doc.text(`ID: ${order.customers.customer_id}`, leftColX, yPos);
    }
    const date = new Date(order.created_at).toLocaleDateString("en-IN");
    doc.text(`Date: ${date}`, rightColX, yPos);
    yPos += 5;
    
    if (order.customers?.phone) {
      doc.text(`Phone: ${order.customers.phone}`, leftColX, yPos);
      yPos += 5;
    }
    
    if (order.customers?.address) {
      const addressLines = doc.splitTextToSize(order.customers.address, 80);
      doc.text(addressLines, leftColX, yPos);
      yPos += addressLines.length * 5;
    }

    yPos += 10;

    // Items Table
    const tableData = items?.map((item, index) => {
      const hasGst = item.total_gst && item.total_gst > 0;
      return [
        index + 1,
        item.part_name,
        item.quantity,
        `₹${Number(item.selling_price).toFixed(2)}`,
        hasGst ? `₹${Number(item.sgst_amount).toFixed(2)}` : "-",
        hasGst ? `₹${Number(item.cgst_amount).toFixed(2)}` : "-",
        `₹${Number(item.subtotal).toFixed(2)}`,
      ];
    }) || [];

    autoTable(doc, {
      startY: yPos,
      head: [["#", "Description", "Qty", "Rate", "SGST", "CGST", "Amount"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 70 },
        2: { cellWidth: 15, halign: "center" },
        3: { cellWidth: 25, halign: "right" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 20, halign: "right" },
        6: { cellWidth: 30, halign: "right" },
      },
    });

    // Get the final Y position after table
    const finalY = (doc as any).lastAutoTable.finalY || yPos + 50;

    // Summary
    const summaryY = finalY + 10;
    const summaryX = pageWidth - 70;

    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", summaryX, summaryY);
    doc.text(`₹${Number(order.total_selling_price || 0).toFixed(2)}`, summaryX + 40, summaryY, { align: "right" });

    const totalGst = items?.reduce((sum, item) => sum + Number(item.total_gst || 0), 0) || 0;
    if (totalGst > 0) {
      doc.text("Total GST:", summaryX, summaryY + 6);
      doc.text(`₹${totalGst.toFixed(2)}`, summaryX + 40, summaryY + 6, { align: "right" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Total Amount:", summaryX, summaryY + 12);
    doc.text(`₹${Number(order.total_amount).toFixed(2)}`, summaryX + 40, summaryY + 12, { align: "right" });

    // Footer
    const footerY = doc.internal.pageSize.height - 20;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Thank you for your business!", pageWidth / 2, footerY, { align: "center" });

    // Save PDF
    doc.save(`Invoice-${order.order_number}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};
