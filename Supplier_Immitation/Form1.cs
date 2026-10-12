using System.Net.Http.Json;
using System.Text.Json;

namespace Supplier_Immitation;

public partial class Form1 : Form
{
    private TextBox txtApiAddress;
    private TextBox txtRestaurantId;
    private TextBox txtApiKey;
    private Button btnGetProducts;
    private Button btnSendSupply;
    private DataGridView dgvProducts;
    private TextBox txtLog;

    public Form1()
    {
        InitializeComponent();
        InitializeCustomComponents();
    }

    private void InitializeCustomComponents()
    {
        this.Text = "Supplier Imitation (Поставщик)";
        this.Size = new System.Drawing.Size(700, 600);
        this.StartPosition = FormStartPosition.CenterScreen;

        int y = 20;
        int labelWidth = 120;
        int inputWidth = 500;

        var lblAddress = new Label { Text = "Адрес API:", Location = new System.Drawing.Point(20, y), Width = labelWidth };
        txtApiAddress = new TextBox { Location = new System.Drawing.Point(150, y), Width = inputWidth, Text = "https://localhost:5067" };
        this.Controls.Add(lblAddress);
        this.Controls.Add(txtApiAddress);
        y += 35;

        var lblRestId = new Label { Text = "RestaurantId:", Location = new System.Drawing.Point(20, y), Width = labelWidth };
        txtRestaurantId = new TextBox { Location = new System.Drawing.Point(150, y), Width = inputWidth, Text = "00000000-0000-0000-0000-000000000000" };
        this.Controls.Add(lblRestId);
        this.Controls.Add(txtRestaurantId);
        y += 35;

        var lblApiKey = new Label { Text = "ApiKey (Secret):", Location = new System.Drawing.Point(20, y), Width = labelWidth };
        txtApiKey = new TextBox { Location = new System.Drawing.Point(150, y), Width = inputWidth, UseSystemPasswordChar = true };
        this.Controls.Add(lblApiKey);
        this.Controls.Add(txtApiKey);
        y += 50;

        btnGetProducts = new Button
        {
            Text = "1. Получить список продуктов",
            Location = new System.Drawing.Point(150, y),
            Width = 240,
            Height = 35
        };
        btnGetProducts.Click += BtnGetProducts_Click;
        this.Controls.Add(btnGetProducts);

        btnSendSupply = new Button
        {
            Text = "2. Отправить поставку",
            Location = new System.Drawing.Point(410, y),
            Width = 240,
            Height = 35,
            Enabled = false
        };
        btnSendSupply.Click += BtnSendSupply_Click;
        this.Controls.Add(btnSendSupply);
        y += 50;

        dgvProducts = new DataGridView
        {
            Location = new System.Drawing.Point(20, y),
            Width = 640,
            Height = 250,
            AllowUserToAddRows = false,
            AllowUserToDeleteRows = false,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            RowHeadersVisible = false
        };

        dgvProducts.Columns.Add(new DataGridViewCheckBoxColumn
        {
            Name = "Select",
            HeaderText = "Выбрать",
            Width = 80
        });
        dgvProducts.Columns.Add(new DataGridViewTextBoxColumn
        {
            Name = "ProductName",
            HeaderText = "Название продукта",
            ReadOnly = true,
            Width = 300
        });
        dgvProducts.Columns.Add(new DataGridViewTextBoxColumn
        {
            Name = "Quantity",
            HeaderText = "Количество",
            Width = 120
        });
        dgvProducts.Columns.Add(new DataGridViewTextBoxColumn
        {
            Name = "ProductId",
            HeaderText = "ID",
            Visible = false
        });

        this.Controls.Add(dgvProducts);
        y += 270;

        txtLog = new TextBox
        {
            Multiline = true,
            ScrollBars = ScrollBars.Vertical,
            Location = new System.Drawing.Point(20, y),
            Width = 640,
            Height = 120,
            ReadOnly = true,
            BackColor = System.Drawing.Color.White
        };
        this.Controls.Add(txtLog);
    }

    private void Log(string message)
    {
        txtLog.AppendText($"[{DateTime.Now:HH:mm:ss}] {message}\r\n");
    }

    private async void BtnGetProducts_Click(object sender, EventArgs e)
    {
        btnGetProducts.Enabled = false;
        btnSendSupply.Enabled = false;
        dgvProducts.Rows.Clear();
        txtLog.Clear();

        string apiAddress = txtApiAddress.Text.TrimEnd('/');
        string restId = txtRestaurantId.Text.Trim();
        string apiKey = txtApiKey.Text.Trim();

        if (!Guid.TryParse(restId, out Guid restaurantId))
        {
            Log("Ошибка: Неверный формат RestaurantId.");
            btnGetProducts.Enabled = true;
            return;
        }

        using var httpClient = new HttpClient();

        try
        {
            Log("Запрос списка продуктов...");
            var url = $"{apiAddress}/api/supply/GetProducts?RestaurantId={restaurantId}&ApiKey={Uri.EscapeDataString(apiKey)}";

            var response = await httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                var errText = await response.Content.ReadAsStringAsync();
                Log($"Ошибка получения: {(int)response.StatusCode} {errText}");
                btnGetProducts.Enabled = true;
                return;
            }

            var json = await response.Content.ReadAsStringAsync();
            var products = JsonSerializer.Deserialize<List<ProductDto>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (products == null || products.Count == 0)
            {
                Log("Продукты не найдены.");
                btnGetProducts.Enabled = true;
                return;
            }

            Log($"Получено продуктов: {products.Count}");

            foreach (var p in products)
            {
                dgvProducts.Rows.Add(false, p.ProductName, 10, p.ProductId);
            }

            btnSendSupply.Enabled = true;
        }
        catch (Exception ex)
        {
            Log($"Критическая ошибка: {ex.Message}");
        }
        finally
        {
            btnGetProducts.Enabled = true;
        }
    }

    private async void BtnSendSupply_Click(object sender, EventArgs e)
    {
        btnSendSupply.Enabled = false;
        Log("\nФормирование и отправка поставки...");

        string apiAddress = txtApiAddress.Text.TrimEnd('/');
        string restId = txtRestaurantId.Text.Trim();
        Guid restaurantId = Guid.Parse(restId);

        var items = new List<object>();

        foreach (DataGridViewRow row in dgvProducts.Rows)
        {
            if (row.Cells["Select"].Value is true)
            {
                if (decimal.TryParse(row.Cells["Quantity"].Value?.ToString(), out decimal qty) && qty > 0)
                {
                    items.Add(new
                    {
                        productId = Guid.Parse(row.Cells["ProductId"].Value.ToString()),
                        quantity = qty
                    });
                }
            }
        }

        if (items.Count == 0)
        {
            Log("Не выбрано ни одного продукта или количество равно 0.");
            btnSendSupply.Enabled = true;
            return;
        }

        Log($"Выбрано позиций: {items.Count}");

        using var httpClient = new HttpClient();

        try
        {
            var payload = new
            {
                restaurantId = restaurantId,
                supplyNumber = $"SUP-{DateTime.UtcNow:yyyyMMdd-HHmmss}",
                items = items
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync($"{apiAddress}/api/supply/incoming", content);

            if (response.IsSuccessStatusCode)
            {
                Log("Поставка успешно отправлена и создана на сервере!");
            }
            else
            {
                var errText = await response.Content.ReadAsStringAsync();
                Log($"Ошибка отправки: {(int)response.StatusCode} {errText}");
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
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = null!;
    public int ShelfLife { get; set; }
}