using System;
using System.Drawing;
using System.Windows.Forms;

namespace POS_immitation;

public partial class AuthForm : Form
{
    private TextBox txtRestaurantId;
    private TextBox txtPin;
    private Button btnLogin;
    private Label lblError;

    public AuthForm()
    {
        InitializeComponent();
        SetupUi();
    }

    private void SetupUi()
    {
        this.Text = "Авторизация POS-терминала";
        this.Size = new Size(300, 250);
        this.StartPosition = FormStartPosition.CenterScreen;

        var lblRest = new Label { Text = "ID Ресторана (Guid):", Location = new Point(20, 20), AutoSize = true };
        txtRestaurantId = new TextBox { Location = new Point(20, 40), Width = 240 };
        
        var lblPin = new Label { Text = "PIN-код:", Location = new Point(20, 80), AutoSize = true };
        txtPin = new TextBox { Location = new Point(20, 100), Width = 240, PasswordChar = '*' };
        
        btnLogin = new Button { Text = "Войти", Location = new Point(20, 140), Width = 240, Height = 40 };
        btnLogin.Click += BtnLogin_Click;

        lblError = new Label { Text = "", Location = new Point(20, 190), Width = 240, ForeColor = Color.Red, TextAlign = ContentAlignment.MiddleCenter };

        this.Controls.AddRange(new Control[] { lblRest, txtRestaurantId, lblPin, txtPin, btnLogin, lblError });
    }

    private async void BtnLogin_Click(object? sender, EventArgs e)
    {
        btnLogin.Enabled = false;
        lblError.Text = "Вход...";

        if (!Guid.TryParse(txtRestaurantId.Text, out var restId))
        {
            lblError.Text = "Неверный формат ID ресторана";
            btnLogin.Enabled = true;
            return;
        }

        var response = await AppState.Api.AuthorizePosAsync(restId, txtPin.Text);
        if (response != null)
        {
            AppState.RestaurantId = restId;
            AppState.SignalR = new POSSignalRClient("http://localhost:5067/hubs/notifications", AppState.Api.CurrentToken!);
            await AppState.SignalR.StartAsync(restId);

            var mainMenu = new POSMainMenu();
            mainMenu.Show();
            this.Hide();
        }
        else
        {
            lblError.Text = "Ошибка авторизации. Проверьте ID и PIN.";
            btnLogin.Enabled = true;
        }
    }
}