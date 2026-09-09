package com.example.expensetracker.controller;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.UserService;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.openpdf.text.Document;
import org.openpdf.text.FontFactory;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.Phrase;
import org.openpdf.text.pdf.PdfPCell;
import org.openpdf.text.pdf.PdfPTable;
import org.openpdf.text.pdf.PdfWriter;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
public class RangeReportController {
    private static final MediaType XLSX = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    private final ExpenseRepository expenses;
    private final IncomeRepository incomes;
    private final UserService users;
    private final UserSecurity security;

    public RangeReportController(ExpenseRepository expenses, IncomeRepository incomes, UserService users, UserSecurity security) {
        this.expenses = expenses; this.incomes = incomes; this.users = users; this.security = security;
    }

    @GetMapping("/user/{userId}/export/range/excel")
    public ResponseEntity<byte[]> excel(@PathVariable Long userId, @RequestParam(required=false) String from,
                                        @RequestParam(required=false) String to, @RequestParam(defaultValue="INR") String currency) {
        security.validateUserAccess(userId);
        User user = user(userId); Range range = Range.of(from, to); Data data = data(user, range);
        return ResponseEntity.ok().contentType(XLSX).header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename("ExpenseTracker_Executive_Dashboard.xlsx").build().toString()).body(excel(data, range, currency));
    }

    @GetMapping("/user/{userId}/export/range/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long userId, @RequestParam(required=false) String from,
                                      @RequestParam(required=false) String to, @RequestParam(defaultValue="INR") String currency) {
        security.validateUserAccess(userId);
        User user = user(userId); Range range = Range.of(from, to); Data data = data(user, range);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename("ExpenseTracker_Executive_Report.pdf").build().toString()).body(pdf(data, range, currency, user.getName()));
    }

    private User user(Long id) { return users.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found")); }

    private Data data(User user, Range range) {
        List<Expense> e = expenses.findByUser(user).stream().filter(x -> range.contains(x.getExpenseDate()))
                .sorted(Comparator.comparing(Expense::getExpenseDate, Comparator.nullsLast(Comparator.reverseOrder()))).collect(Collectors.toList());
        List<Income> i = incomes.findByUser(user).stream().filter(x -> range.contains(x.getIncomeDate()))
                .sorted(Comparator.comparing(Income::getIncomeDate, Comparator.nullsLast(Comparator.reverseOrder()))).collect(Collectors.toList());
        return new Data(e, i);
    }

    private byte[] excel(Data d, Range range, String currency) {
        String s = symbol(currency); BigDecimal spend=d.spend(), income=d.income(), net=income.subtract(spend);
        try (XSSFWorkbook wb=new XSSFWorkbook(); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            CellStyle hero=style(wb,"0F172A","FFFFFF",true,16), header=style(wb,"334155","FFFFFF",true,10), body=style(wb,"F8FAFC","0F172A",false,10);
            CellStyle good=style(wb,"ECFDF5","047857",true,10), bad=style(wb,"FEF2F2","B91C1C",true,10), money=style(wb,"F8FAFC","0F172A",false,10);
            money.setDataFormat(wb.createDataFormat().getFormat("\""+s+" \"#,##0.00;(\""+s+" \"#,##0.00);\"-\""));
            Sheet dash=wb.createSheet("Executive Dashboard"); dash.setDisplayGridlines(false); dash.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0,1,0,7));
            put(dash,0,0,"EXPENSETRACKER | EXECUTIVE FINANCIAL DASHBOARD",hero); put(dash,2,0,"Reporting period",header); put(dash,2,1,range.label(),body);
            put(dash,4,0,"TOTAL SPEND",header); put(dash,5,0,spend,money); put(dash,4,2,"TOTAL INCOME",header); put(dash,5,2,income,money);
            put(dash,4,4,"NET CASH FLOW",header); put(dash,5,4,net,net.signum()>=0?good:bad); put(dash,4,6,"TRANSACTIONS",header); put(dash,5,6,d.expenses.size(),body);
            put(dash,7,0,"KEY INSIGHTS",header); List<String> insights=insights(d,spend,income,s); for(int n=0;n<insights.size();n++) put(dash,8+n,0,insights.get(n),body); for(int c=0;c<8;c++) dash.setColumnWidth(c,20*256);

            Sheet cat=wb.createSheet("Category Analysis"); cat.setDisplayGridlines(false); put(cat,0,0,"CATEGORY PERFORMANCE",hero);
            String[] ch={"Category","Spend","Share","Transactions","Average"}; for(int c=0;c<ch.length;c++) put(cat,2,c,ch[c],header);
            Map<String,List<Expense>> groups=d.expenses.stream().collect(Collectors.groupingBy(x->x.getCategory()==null?"Uncategorized":x.getCategory().getName(),LinkedHashMap::new,Collectors.toList())); int r=3;
            for(var entry:groups.entrySet().stream().sorted((a,b)->total(b.getValue()).compareTo(total(a.getValue()))).toList()) { BigDecimal t=total(entry.getValue()); double pct=spend.signum()==0?0:t.divide(spend,4,RoundingMode.HALF_UP).doubleValue();
                put(cat,r,0,entry.getKey(),body); put(cat,r,1,t,money); put(cat,r,2,pct,body); put(cat,r,3,entry.getValue().size(),body); put(cat,r,4,t.divide(BigDecimal.valueOf(entry.getValue().size()),2,RoundingMode.HALF_UP),money); r++; }
            for(int c=0;c<5;c++) cat.setColumnWidth(c,new int[]{28,18,14,16,18}[c]*256);

            Sheet tx=wb.createSheet("Transactions"); tx.setDisplayGridlines(false); String[] th={"Date","Category","Description","Amount","Recurring"}; for(int c=0;c<th.length;c++) put(tx,0,c,th[c],header); r=1;
            for(Expense x:d.expenses){put(tx,r,0,x.getExpenseDate()==null?"":x.getExpenseDate().toString(),body);put(tx,r,1,x.getCategory()==null?"Uncategorized":x.getCategory().getName(),body);put(tx,r,2,x.getDescription()==null?"":x.getDescription(),body);put(tx,r,3,nz(x.getAmount()),money);put(tx,r,4,x.isRecurring()?"Yes":"No",body);r++;}
            for(int c=0;c<5;c++) tx.setColumnWidth(c,new int[]{16,24,48,18,14}[c]*256);

            Sheet cash=wb.createSheet("Cash Flow"); cash.setDisplayGridlines(false); String[] fh={"Month","Income","Spend","Net"}; for(int c=0;c<4;c++) put(cash,0,c,fh[c],header);
            Map<String,BigDecimal> im=d.incomes.stream().filter(x->x.getIncomeDate()!=null).collect(Collectors.groupingBy(x->x.getIncomeDate().withDayOfMonth(1).toString(),Collectors.mapping(x->nz(x.getAmount()),Collectors.reducing(BigDecimal.ZERO,BigDecimal::add))));
            Map<String,BigDecimal> em=d.expenses.stream().filter(x->x.getExpenseDate()!=null).collect(Collectors.groupingBy(x->x.getExpenseDate().withDayOfMonth(1).toString(),Collectors.mapping(x->nz(x.getAmount()),Collectors.reducing(BigDecimal.ZERO,BigDecimal::add))));
            r=1; Set<String> months=new TreeSet<>();months.addAll(im.keySet());months.addAll(em.keySet()); for(String m:months){BigDecimal i=im.getOrDefault(m,BigDecimal.ZERO),e=em.getOrDefault(m,BigDecimal.ZERO);put(cash,r,0,m,body);put(cash,r,1,i,money);put(cash,r,2,e,money);put(cash,r,3,i.subtract(e),i.compareTo(e)>=0?good:bad);r++;} for(int c=0;c<4;c++)cash.setColumnWidth(c,20*256);
            wb.write(out); return out.toByteArray();
        } catch(Exception ex){throw new IllegalStateException("Unable to create executive Excel report",ex);}
    }

    private byte[] pdf(Data d, Range range, String currency, String name) {
        String s=symbol(currency); BigDecimal spend=d.spend(), income=d.income(), net=income.subtract(spend);
        try(ByteArrayOutputStream out=new ByteArrayOutputStream()){Document doc=new Document(PageSize.A4,34,34,38,38);PdfWriter.getInstance(doc,out);doc.open();
            var title=FontFactory.getFont(FontFactory.HELVETICA_BOLD,22,new Color(15,23,42));var muted=FontFactory.getFont(FontFactory.HELVETICA,9,new Color(100,116,139));var bold=FontFactory.getFont(FontFactory.HELVETICA_BOLD,10,new Color(15,23,42));
            doc.add(new Paragraph("EXPENSETRACKER",title));doc.add(new Paragraph("Executive Financial Intelligence Report",FontFactory.getFont(FontFactory.HELVETICA_BOLD,14,new Color(79,70,229))));doc.add(new Paragraph("Prepared for "+name+" | "+range.label()+" | "+currency,muted));
            PdfPTable k=new PdfPTable(4);k.setWidthPercentage(100);kpi(k,"TOTAL SPEND",s+" "+spend,new Color(239,68,68));kpi(k,"TOTAL INCOME",s+" "+income,new Color(16,185,129));kpi(k,"NET CASH FLOW",s+" "+net,net.signum()>=0?new Color(16,185,129):new Color(239,68,68));kpi(k,"TRANSACTIONS",String.valueOf(d.expenses.size()),new Color(79,70,229));doc.add(k);
            doc.add(new Paragraph("Key insights",bold));for(String x:insights(d,spend,income,s))doc.add(new Paragraph("- "+x,muted));
            Map<String,BigDecimal> cats=d.expenses.stream().collect(Collectors.groupingBy(x->x.getCategory()==null?"Uncategorized":x.getCategory().getName(),Collectors.mapping(x->nz(x.getAmount()),Collectors.reducing(BigDecimal.ZERO,BigDecimal::add))));
            doc.add(new Paragraph("Category breakdown",bold));PdfPTable ct=new PdfPTable(3);ct.setWidthPercentage(100);head(ct,"Category");head(ct,"Spend");head(ct,"Share");for(var e:cats.entrySet().stream().sorted((a,b)->b.getValue().compareTo(a.getValue())).toList()){ct.addCell(new Phrase(e.getKey(),muted));ct.addCell(new Phrase(s+" "+e.getValue(),muted));ct.addCell(new Phrase((spend.signum()==0?BigDecimal.ZERO:e.getValue().multiply(BigDecimal.valueOf(100)).divide(spend,1,RoundingMode.HALF_UP))+"%",muted));}doc.add(ct);
            doc.add(new Paragraph("Transaction ledger",bold));PdfPTable t=new PdfPTable(4);t.setWidthPercentage(100);head(t,"Date");head(t,"Category");head(t,"Description");head(t,"Amount");for(Expense x:d.expenses){t.addCell(new Phrase(x.getExpenseDate()==null?"":x.getExpenseDate().toString(),muted));t.addCell(new Phrase(x.getCategory()==null?"Uncategorized":x.getCategory().getName(),muted));t.addCell(new Phrase(x.getDescription()==null?"":x.getDescription(),muted));t.addCell(new Phrase(s+" "+nz(x.getAmount()),muted));}doc.add(t);doc.add(new Paragraph("Generated from live persisted ledger data at export time.",muted));doc.close();return out.toByteArray();
        }catch(Exception ex){throw new IllegalStateException("Unable to create executive PDF report",ex);}
    }

    private static List<String> insights(Data d,BigDecimal spend,BigDecimal income,String s){String top=d.expenses.stream().collect(Collectors.groupingBy(x->x.getCategory()==null?"Uncategorized":x.getCategory().getName(),Collectors.mapping(x->nz(x.getAmount()),Collectors.reducing(BigDecimal.ZERO,BigDecimal::add)))).entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("No category data");BigDecimal avg=d.expenses.isEmpty()?BigDecimal.ZERO:spend.divide(BigDecimal.valueOf(d.expenses.size()),2,RoundingMode.HALF_UP);return List.of("Largest cost centre: "+top+".","Average expense per transaction: "+s+" "+avg+".",(income.compareTo(spend)>=0?"Cash flow is positive for this period.":"Spending exceeded recorded income in this period."),d.expenses.isEmpty()?"No expenses were recorded in the selected period.":"Review the highest-cost category and recurring transactions before the next cycle.");}
    private static BigDecimal total(List<Expense> e){return e.stream().map(x->nz(x.getAmount())).reduce(BigDecimal.ZERO,BigDecimal::add);} private static BigDecimal nz(BigDecimal b){return b==null?BigDecimal.ZERO:b;}
    private static String symbol(String c){if(c==null)return "₹";return switch(c.toUpperCase()){case "USD"->"$";case "EUR"->"€";case "GBP"->"£";case "JPY"->"¥";case "AED"->"AED";case "INR"->"₹";default->c.toUpperCase();};}
    private static CellStyle style(Workbook w,String bg,String fg,boolean bold,int size){CellStyle s=w.createCellStyle();s.setFillForegroundColor(new org.apache.poi.xssf.usermodel.XSSFColor(Color.decode("#"+bg),null));s.setFillPattern(FillPatternType.SOLID_FOREGROUND);Font f=w.createFont();f.setColor(new org.apache.poi.xssf.usermodel.XSSFColor(Color.decode("#"+fg),null));f.setBold(bold);f.setFontHeightInPoints((short)size);f.setFontName("Aptos");s.setFont(f);s.setVerticalAlignment(VerticalAlignment.CENTER);return s;}
    private static void put(Sheet sh,int r,int c,Object v,CellStyle s){Cell cell=sh.getRow(r)==null?sh.createRow(r).createCell(c):sh.getRow(r).createCell(c);if(v instanceof BigDecimal b)cell.setCellValue(b.doubleValue());else if(v instanceof Number n)cell.setCellValue(n.doubleValue());else cell.setCellValue(String.valueOf(v));cell.setCellStyle(s);}
    private static void kpi(PdfPTable t,String l,String v,Color c){PdfPCell p=new PdfPCell();p.setPadding(9);p.setBorderColor(new Color(226,232,240));p.addElement(new Paragraph(l,FontFactory.getFont(FontFactory.HELVETICA_BOLD,8,c)));p.addElement(new Paragraph(v,FontFactory.getFont(FontFactory.HELVETICA_BOLD,12,new Color(15,23,42))));t.addCell(p);} private static void head(PdfPTable t,String x){PdfPCell p=new PdfPCell(new Phrase(x,FontFactory.getFont(FontFactory.HELVETICA_BOLD,8,Color.WHITE)));p.setBackgroundColor(new Color(30,41,59));p.setPadding(7);t.addCell(p);}
    private record Data(List<Expense> expenses,List<Income> incomes){BigDecimal spend(){return total(expenses);}BigDecimal income(){return incomes.stream().map(x->nz(x.getAmount())).reduce(BigDecimal.ZERO,BigDecimal::add);}}
    private record Range(LocalDate from,LocalDate to){static Range of(String f,String t){LocalDate a=f==null||f.isBlank()?null:LocalDate.parse(f),b=t==null||t.isBlank()?null:LocalDate.parse(t);if(a!=null&&b!=null&&b.isBefore(a))throw new IllegalArgumentException("End date must be on or after start date.");return new Range(a,b);}boolean contains(LocalDate d){return d!=null&&(from==null||!d.isBefore(from))&&(to==null||!d.isAfter(to));}String label(){return from==null&&to==null?"All time":from==null?"Through "+to:to==null?"From "+from:from+" to "+to;}}
}
