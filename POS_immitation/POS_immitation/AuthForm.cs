using System;
using System.Drawing;
using System.Windows.Forms;
using System.Threading.Tasks;

namespace POS_immitation;

public partial class AuthForm : Form
{
    private TextBox txtEmail;
    private TextBox txtPassword;
    private Button btnLogin;
    private Label lblError;

    public AuthForm()
    {
        InitializeComponent();
        SetupUi();
    }

    private void SetupUi()
    {
        this.Text = "Авторизация POS-терминала (Кассир)";
        this.Size = new Size(350, 280);
        this.StartPosition = FormStartPosition.CenterScreen;
        this.FormBorderStyle = FormBorderStyle.FixedSingle;
        this.MaximizeBox = false;

        var lblEmail = new Label { Text = "Email кассира:", Location = new Point(20, 20), AutoSize = true };
        txtEmail = new TextBox { Location = new Point(20, 40), Width = 290 };
        
        var lblPass = new Label { Text = "Пароль (PIN):", Location = new Point(20, 80), AutoSize = true };
        txtPassword = new TextBox { Location = new Point(20, 100), Width = 290, PasswordChar = '*' };
        
        btnLogin = new Button { Text = "Войти", Location = new Point(20, 140), Width = 290, Height = 40 };
        btnLogin.Click += BtnLogin_Click;

        lblError = new Label { Text = "", Location = new Point(20, 190), Width = 290, ForeColor = Color.Red, TextAlign = ContentAlignment.MiddleCenter };

        this.Controls.AddRange(new Control[] { lblEmail, txtEmail, lblPass, txtPassword, btnLogin, lblError });
        
        // Позволяет нажать Enter для входа
        this.AcceptButton = btnLogin;
    }

    private async void BtnLogin_Click(object? sender, EventArgs e)
    {
        btnLogin.Enabled = false;
        lblError.Text = "Вход...";

        var email = txtEmail.Text.Trim();
        var password = txtPassword.Text.Trim();

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            lblError.Text = "Введите email и пароль";
            btnLogin.Enabled = true;
            return;
        }

        try
        {
            // Вызываем стандартный метод авторизации пользователя
            var response = await AppState.Api.AuthorizeUserAsync(email, password);
            
            if (response != null && !string.IsNullOrEmpty(response.Token))
            {
                // Токен уже сохранён внутри AppState.Api
                // Если твой API возвращает RestaurantId в ответе, раскомментируй строку ниже:
                // AppState.RestaurantId = response.RestaurantId;

                var mainMenu = new POSMainMenu();
                mainMenu.Show();
                this.Hide();
            }
            else
            {
                lblError.Text = "Ошибка авторизации. Проверьте email и пароль.";
                btnLogin.Enabled = true;
            }
        }
        catch (Exception ex)
        {
            lblError.Text = $"Ошибка сети: {ex.Message}";
            btnLogin.Enabled = true;
        }
    }
}