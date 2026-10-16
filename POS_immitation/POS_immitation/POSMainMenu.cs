using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace POS_immitation;

public partial class POSMainMenu : Form
{
    private readonly ApiService _api;
    private List<DishOrderItem> _currentOrder = new();
    private Dictionary<Guid, decimal> _dishPrices = new();
    
    private FlowLayoutPanel panelMenu = null!;
    private FlowLayoutPanel panelRecommendations = null!;
    private FlowLayoutPanel panelCart = null!;
    private Label lblTotal = null!;
    private Label lblStatus = null!;
    private Button btnCheckout = null!;
    private Button btnCancel = null!;

    public POSMainMenu()
    {
        _api = AppState.Api;
        InitializeComponent();
        SetupUi();
        LoadDataAsync();
    }

    private void SetupUi()
    {
        this.Text = "POS-Terminal";
        this.Size = new Size(1000, 700);
        this.StartPosition = FormStartPosition.CenterScreen;

        var topPanel = new Panel { Dock = DockStyle.Top, Height = 60, BackColor = Color.LightGray };
        var lblTitle = new Label { Text = "New Order", Dock = DockStyle.Left, Width = 200, Font = new Font("Arial", 14, FontStyle.Bold), TextAlign = ContentAlignment.MiddleCenter };
        lblStatus = new Label { Text = "Ready", Dock = DockStyle.Fill, Font = new Font("Arial", 12), TextAlign = ContentAlignment.MiddleRight, Padding = new Padding(0, 0, 20, 0) };
        topPanel.Controls.Add(lblStatus);
        topPanel.Controls.Add(lblTitle);

        var mainTable = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1 };
        mainTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40F));
        mainTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40F));
        mainTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 20F));

        var menuPanel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(5) };
        panelMenu = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, WrapContents = true };
        menuPanel.Controls.Add(panelMenu);

        var recPanel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(5), BackColor = Color.Beige };
        var lblRec = new Label { Text = "Priority Items", Dock = DockStyle.Top, Height = 30, Font = new Font("Arial", 11, FontStyle.Bold), TextAlign = ContentAlignment.MiddleCenter };
        panelRecommendations = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, WrapContents = true };
        recPanel.Controls.Add(panelRecommendations);
        recPanel.Controls.Add(lblRec);

        var cartPanel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(5) };
        panelCart = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, WrapContents = false, FlowDirection = FlowDirection.TopDown };
        
        var bottomCartPanel = new Panel { Dock = DockStyle.Bottom, Height = 100 };
        lblTotal = new Label { Text = "Total: 0 RUB", Dock = DockStyle.Fill, Font = new Font("Arial", 14, FontStyle.Bold), TextAlign = ContentAlignment.MiddleCenter };
        btnCheckout = new Button { Text = "CHECKOUT", Dock = DockStyle.Right, Width = 150, BackColor = Color.LightGreen, Font = new Font("Arial", 12, FontStyle.Bold) };
        btnCancel = new Button { Text = "Cancel", Dock = DockStyle.Left, Width = 100, BackColor = Color.LightCoral };

        btnCheckout.Click += BtnCheckout_Click;
        btnCancel.Click += BtnCancel_Click;

        bottomCartPanel.Controls.Add(lblTotal);
        bottomCartPanel.Controls.Add(btnCheckout);
        bottomCartPanel.Controls.Add(btnCancel);
        
        cartPanel.Controls.Add(panelCart);
        cartPanel.Controls.Add(bottomCartPanel);

        mainTable.Controls.Add(menuPanel, 0, 0);
        mainTable.Controls.Add(recPanel, 1, 0);
        mainTable.Controls.Add(cartPanel, 2, 0);

        this.Controls.Add(mainTable);
        this.Controls.Add(topPanel);
    }

    private async void LoadDataAsync()
    {
        lblStatus.Text = "Loading menu...";
        panelMenu.Controls.Clear();
        panelRecommendations.Controls.Clear();
        _dishPrices.Clear();

        if (AppState.RestaurantId == Guid.Empty)
        {
            lblStatus.Text = "Error: RestaurantId not set";
            return;
        }

        var dishes = await _api.GetMenuAsync(AppState.RestaurantId);
        var recs = await _api.GetRecommendationsAsync(AppState.RestaurantId);
        var stopList = await _api.GetStopListAsync(AppState.RestaurantId);

        foreach (var dish in dishes)
        {
            if (stopList.Contains(dish.Id)) continue;

            _dishPrices[dish.Id] = dish.Price;
            var btn = CreateDishButton(dish, Color.White, () => AddToOrder(dish));
            panelMenu.Controls.Add(btn);
        }

        foreach (var rec in recs.Take(5))
        {
            var dish = dishes.FirstOrDefault(d => d.Id == rec.DishId);
            if (dish != null)
            {
                var btn = CreateDishButton(dish, Color.LightYellow, () => AddToOrder(dish));
                panelRecommendations.Controls.Add(btn);
            }
        }

        lblStatus.Text = "Ready";
        UpdateOrderUI();
    }

    private Button CreateDishButton(DishDto dish, Color bgColor, Action onClick)
    {
        var btn = new Button
        {
            Text = $"{dish.Name}\n{dish.Price} RUB",
            Width = panelMenu.Width / 2 - 15,
            Height = 70,
            BackColor = bgColor,
            Font = new Font("Arial", 10, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleCenter,
            Margin = new Padding(3)
        };
        btn.Click += (s, e) => onClick();
        return btn;
    }

    private void AddToOrder(DishDto dish)
    {
        var index = _currentOrder.FindIndex(x => x.DishId == dish.Id);
        if (index != -1)
        {
            _currentOrder[index] = _currentOrder[index] with { Quantity = _currentOrder[index].Quantity + 1 };
        }
        else
        {
            _currentOrder.Add(new DishOrderItem(dish.Id, 1));
        }
        UpdateOrderUI();
    }

    private void RemoveFromOrderById(Guid dishId)
    {
        var index = _currentOrder.FindIndex(x => x.DishId == dishId);
        if (index != -1)
        {
            var item = _currentOrder[index];
            if (item.Quantity <= 1)
            {
                _currentOrder.RemoveAt(index);
            }
            else
            {
                _currentOrder[index] = item with { Quantity = item.Quantity - 1 };
            }
        }
        UpdateOrderUI();
    }

    private void UpdateOrderUI()
    {
        panelCart.Controls.Clear();
        decimal total = 0;
        
        foreach (var item in _currentOrder)
        {
            decimal price = _dishPrices.GetValueOrDefault(item.DishId, 0);
            decimal lineTotal = price * item.Quantity;
            total += lineTotal;

            var btn = new Button
            {
                Text = $"{item.DishId.ToString()[..4]}...\nQty: {item.Quantity} | {lineTotal} RUB",
                Width = panelCart.Width - 20,
                Height = 50,
                BackColor = Color.LightBlue,
                Font = new Font("Arial", 10),
                Margin = new Padding(2)
            };
            
            btn.Click += (s, e) => RemoveFromOrderById(item.DishId);
            panelCart.Controls.Add(btn);
        }

        lblTotal.Text = $"Total: {total} RUB";
    }

    private async void BtnCheckout_Click(object? sender, EventArgs e)
    {
        if (_currentOrder.Count == 0) return;

        btnCheckout.Enabled = false;
        lblStatus.Text = "Processing order...";

        bool success = await _api.CheckoutAsync(AppState.RestaurantId, _currentOrder);

        if (success)
        {
            lblStatus.Text = "Order completed successfully";
            _currentOrder.Clear();
            UpdateOrderUI();
            LoadDataAsync(); 
        }
        else
        {
            lblStatus.Text = "Error: insufficient stock or network failure";
        }

        btnCheckout.Enabled = true;
    }

    private void BtnCancel_Click(object? sender, EventArgs e)
    {
        _currentOrder.Clear();
        UpdateOrderUI();
        lblStatus.Text = "Order cleared";
    }
}