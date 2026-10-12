using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Supplier_Immitation;

public partial class Form1 : Form
{
    private TextBox txtApiAddress;
    private TextBox txtRestaurantId;
    private TextBox txtApiSecret;
    private Button btnSendSupply;
    private TextBox txtLog;

    public Form1()
    {
        InitializeComponent();
        InitializeCustomComponents();
    }

    private void InitializeCustomComponents()
    {
        this.Text = "Supplier Imitation (Поставщик)";
        this.Size = new System.Drawing.Size(600, 500);
        this.StartPosition = FormStartPosition.CenterScreen;

        int y = 20;
        int labelWidth = 120;
        int textBoxWidth = 400;

        var lblAddress = new Label { Text = "Адрес API:", Location = new System.Drawing.Point(20, y), Width = labelWidth };
        txtApiAddress = new TextBox { Location = new System.Drawing.Point(150, y), Width = textBoxWidth, Text = "https://localhost:7001" };
        this.Controls.Add(lblAddress);
        this.Controls.Add(txtApiAddress);
        y += 35;

        var lblRestId = new Label { Text = "RestaurantId:", Location = new System.Drawing.Point(20, y), Width = labelWidth };
        txtRestaurantId = new TextBox { Location = new System.Drawing.Point(150, y), Width = textBoxWidth, Text = "00000000-0000-0000-0000-000000000000" };
        this.Controls.Add(lblRestId);
        this.Controls.Add(txtRestaurantId);
        y += 35;

        var lblSecret = new Label { Text = "ApiSecret:", Location = new System.Drawing.Point(20, y), Width = labelWidth };
        txtApiSecret = new TextBox { Location = new System.Drawing.Point(150, y), Width = textBoxWidth };
        this.Controls.Add(lblSecret);
        this.Controls.Add(txtApiSecret);
        y += 50;

        btnSendSupply = new Button
        {
            Text = "Получить продукты и отправить поставку",
            Location = new System.Drawing.Point(150, y),
            Width = textBoxWidth,
            Height = 40
        };
        btnSendSupply.Click += BtnSendSupply_Click;
        this.Controls.Add(btnSendSupply);
        y += 60;

        txtLog = new TextBox
        {
            Multiline = true,
            ScrollBars = ScrollBars.Vertical,
            Location = new System.Drawing.Point(20, y),
            Width = 540,
            Height = 250,
            ReadOnly = true,
            BackColor = System.Drawing.Color.White
        };
        this.Controls.Add(txtLog);
    }

    private void Log(string message)
    {
        txtLog.AppendText($"[{DateTime.Now:HH:mm:ss}] {message}\r\n");
    }

    private async void BtnSendSupply_Click(object sender, EventArgs e)
    {
        btnSendSupply.Enabled = false;
        txtLog.Clear();

        string apiAddress = txtApiAddress.Text.TrimEnd('/');
        string restIdStr = txtRestaurantId.Text.Trim();
        string apiSecret = txtApiSecret.Text.Trim();

        if (!Guid.TryParse(restIdStr, out Guid restaurantId))
        {
            Log("Неверный формат RestaurantId (должен быть GUID)");
            btnSendSupply.Enabled = true;
            return;
        }

        using var httpClient = new HttpClient();
        httpClient.BaseAddress = new Uri(apiAddress);

        if (!string.IsNullOrEmpty(apiSecret))
        {
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiSecret);
        }

        try
        {
            Log("Получение списка продуктов...");
            var response = await httpClient.GetAsync($"/api/product/restaurant/{restaurantId}");

            if (!response.IsSuccessStatusCode)
            {
                Log($" Ошибка получения продуктов: {(int)response.StatusCode} {response.ReasonPhrase}");
                btnSendSupply.Enabled = true;
                return;
            }

            var json = await response.Content.ReadAsStringAsync();
            var products = JsonSerializer.Deserialize<List<ProductDto>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (products == null || products.Count == 0)
            {
                Log("Продукты не найдены для этого ресторана");
                btnSendSupply.Enabled = true;
                return;
            }

            Log($"Получено продуктов: {products.Count}");
            foreach (var p in products)
            {
                Log($"   - {p.Name} (ID: {p.Id})");
            }

            Log("\nГенерация случайной поставки...");
            var random = new Random();
            var itemsCount = random.Next(1, Math.Min(3, products.Count) + 1);
            var selectedProducts = products.OrderBy(_ => random.Next()).Take(itemsCount).ToList();

            var supply = new
            {
                RestaurantId = restaurantId,
                SupplyNumber = $"SUP-{DateTime.UtcNow:yyyyMMdd-HHmmss}",
                Items = selectedProducts.Select(p => new { ProductId = p.Id, Quantity = random.Next(10, 100) }).ToList()
            };

            Log($"Номер поставки: {supply.SupplyNumber}");
            foreach (var item in supply.Items)
            {
                var prodName = products.First(p => p.Id == item.ProductId).Name;
                Log($"   - {prodName}: {item.Quantity} шт.");
            }

            Log("\n Отправка поставки на сервер...");
            var supplyJson = JsonSerializer.Serialize(supply);
            var content = new StringContent(supplyJson, Encoding.UTF8, "application/json");

            var postResponse = await httpClient.PostAsync("/api/supply/incoming", content);

            if (postResponse.IsSuccessStatusCode)
            {
                Log("Поставка успешно создана на сервере");
            }
            else
            {
                var errText = await postResponse.Content.ReadAsStringAsync();
                Log($"Ошибка при создании поставки: {(int)postResponse.StatusCode} {errText}");
            }
        }
        catch (Exception ex)
        {
            Log($" Критическая ошибка: {ex.Message}");
        }
        finally
        {
            btnSendSupply.Enabled = true;
        }
    }
}

public class ProductDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public Guid RestaurantId { get; set; }
    public int ShelfLife { get; set; }
}