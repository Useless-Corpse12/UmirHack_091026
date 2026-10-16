using System;
using System.Drawing;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace POS_immitation;

public partial class POSMainMenu : Form
{
    private FlowLayoutPanel panelMenu;
    private FlowLayoutPanel panelRecommendations;
    private FlowLayoutPanel panelCart;
    private Label lblTotal;

    public POSMainMenu()
    {
        InitializeComponent();
        this.Text = $"POS Терминал - Ресторан: {AppState.RestaurantId}";
        this.Size = new Size(1000, 700);
        this.StartPosition = FormStartPosition.CenterScreen;
        
        SetupUi();
        LoadInitialData();
    }

    private void SetupUi()
    {
        var topPanel = new Panel { Dock = DockStyle.Top, Height = 50, BackColor = Color.LightGray };
        var btnRefresh = new Button { Text = "Обновить меню", Location = new Point(10, 10), Width = 150 };
        btnRefresh.Click += async (s, e) => await LoadInitialData();
        
        var btnExit = new Button { Text = "Выход", Location = new Point(this.Width - 160, 10), Width = 100, BackColor = Color.IndianRed };
        btnExit.Click += (s, e) => { AppState.Clear(); Application.Exit(); };

        topPanel.Controls.AddRange(new Control[] { btnRefresh, btnExit });

        var mainSplit = new SplitContainer { Dock = DockStyle.Fill, Orientation = Orientation.Vertical, SplitterDistance = 600 };

        var menuGroup = new GroupBox { Dock = DockStyle.Fill, Text = "Меню" };
        panelMenu = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, WrapContents = true };
        menuGroup.Controls.Add(panelMenu);
        mainSplit.Panel1.Controls.Add(menuGroup);

        var rightSplit = new SplitContainer { Dock = DockStyle.Fill, Orientation = Orientation.Horizontal, SplitterDistance = 200 };
        
        var recGroup = new GroupBox { Dock = DockStyle.Fill, Text = "Рекомендации" };
        panelRecommendations = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, WrapContents = true, BackColor = Color.LightYellow };
        recGroup.Controls.Add(panelRecommendations);
        rightSplit.Panel1.Controls.Add(recGroup);

        var cartGroup = new GroupBox { Dock = DockStyle.Fill, Text = "Текущий заказ" };
        var cartLayout = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 1 };
        cartLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
        cartLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 30F));
        cartLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 50F));

        panelCart = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, WrapContents = true, BackColor = Color.WhiteSmoke };
        cartLayout.Controls.Add(panelCart, 0, 0);

        lblTotal = new Label { Text = "Позиций: 0", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleRight, Font = new Font(Font.FontFamily, 12, FontStyle.Bold) };
        cartLayout.Controls.Add(lblTotal, 0, 1);

        var cartButtons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft };
        var btnCancel = new Button { Text = "Отмена", Width = 100, Height = 40, BackColor = Color.Orange };
        btnCancel.Click += async (s, e) => await CancelOrder();
        var btnPay = new Button { Text = "Оплатить", Width = 100, Height = 40, BackColor = Color.LightGreen };
        btnPay.Click += async (s, e) => await PayOrder();

        cartButtons.Controls.AddRange(new Control[] { btnPay, btnCancel });
        cartLayout.Controls.Add(cartButtons, 0, 2);
        
        cartGroup.Controls.Add(cartLayout);
        rightSplit.Panel2.Controls.Add(cartGroup);

        mainSplit.Panel2.Controls.Add(rightSplit);

        this.Controls.AddRange(new Control[] { topPanel, mainSplit });
    }

    private async Task LoadInitialData()
    {
        AppState.Menu = await AppState.Api.GetMenuAsync(AppState.RestaurantId);
        AppState.StopList = await AppState.Api.GetStopListAsync(AppState.RestaurantId);
        AppState.Recommendations = await AppState.Api.GetRecommendationsAsync(AppState.RestaurantId);
        
        RenderMenu();
        RenderRecommendations();
        RenderCart();
    }

    private void RenderMenu()
    {
        panelMenu.Controls.Clear();
        foreach (var dish in AppState.Menu)
        {
            var btn = new Button 
            { 
                Text = dish.Name, 
                Width = 180, 
                Height = 80, 
                Margin = new Padding(5),
                TextAlign = ContentAlignment.MiddleCenter
            };

            if (AppState.StopList.Contains(dish.Id))
            {
                btn.Enabled = false;
                btn.BackColor = Color.LightGray;
                btn.ForeColor = Color.Red;
                btn.Text += "\n(НЕТ В НАЛИЧИИ)";
            }
            else
            {
                btn.BackColor = Color.White;
                btn.Click += (s, e) => AddToCart(dish);
            }
            panelMenu.Controls.Add(btn);
        }
    }

    private void RenderRecommendations()
    {
        panelRecommendations.Controls.Clear();
        if (AppState.Recommendations.Count == 0)
        {
            panelRecommendations.Controls.Add(new Label { Text = "Нет рекомендаций", AutoSize = true });
            return;
        }

        foreach (var rec in AppState.Recommendations)
        {
            var btn = new Button 
            { 
                Text = $"{rec.Name}\n(Счёт: {rec.Score:F1})", 
                Width = 180, 
                Height = 70, 
                Margin = new Padding(5),
                BackColor = Color.LightGoldenrodYellow,
                TextAlign = ContentAlignment.MiddleCenter
            };
            btn.Click += (s, e) => 
            {
                var dish = AppState.Menu.FirstOrDefault(d => d.Id == rec.DishId);
                if (dish != null && !AppState.StopList.Contains(dish.Id))
                {
                    AddToCart(dish);
                }
            };
            panelRecommendations.Controls.Add(btn);
        }
    }

    private void AddToCart(DishDto dish)
    {
        _ = AddToCartAsync(dish);
    }

    private async Task AddToCartAsync(DishDto dish)
    {
        AppState.CurrentCartId = await AppState.Api.AddToCartAsync(AppState.RestaurantId, AppState.CurrentCartId, dish.Id);
        AppState.Cart.Add(dish);
        RenderCart();
    }

    private void RenderCart()
    {
        panelCart.Controls.Clear();

        foreach (var dish in AppState.Cart)
        {
            var btn = new Button 
            { 
                Text = dish.Name, 
                Width = 250, 
                Height = 40, 
                Margin = new Padding(3),
                BackColor = Color.MistyRose,
                TextAlign = ContentAlignment.MiddleLeft
            };
            btn.Click += (s, e) => 
            {
                AppState.Cart.Remove(dish);
                RenderCart();
            };
            panelCart.Controls.Add(btn);
        }

        lblTotal.Text = $"Позиций: {AppState.Cart.Count}";
    }

    private async Task PayOrder()
    {
        if (AppState.Cart.Count == 0 || string.IsNullOrEmpty(AppState.CurrentCartId)) return;

        var success = await AppState.Api.CreateOrderAsync(AppState.RestaurantId, AppState.CurrentCartId);
        if (success)
        {
            MessageBox.Show("Заказ успешно оплачен!", "Успех", MessageBoxButtons.OK, MessageBoxIcon.Information);
            AppState.Cart.Clear();
            AppState.CurrentCartId = null;
            RenderCart();
            await LoadInitialData();
        }
        else
        {
            MessageBox.Show("Ошибка при оплате.", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async Task CancelOrder()
    {
        if (AppState.Cart.Count == 0 || string.IsNullOrEmpty(AppState.CurrentCartId)) return;

        var success = await AppState.Api.CancelCartAsync(AppState.RestaurantId, AppState.CurrentCartId);
        if (success)
        {
            MessageBox.Show("Корзина очищена.", "Отмена", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            AppState.Cart.Clear();
            AppState.CurrentCartId = null;
            RenderCart();
        }
    }
}