import React from 'react';
import {
  Layout,
  Row,
  Col,
  Typography,
  Form,
  Input,
  Button,
  Checkbox,
  message,
} from 'antd';

const { Content } = Layout;
const { Title, Text } = Typography;

const AUTH_TOKEN_KEY = 'dormease_token';

interface LoginProps {
  onNavigateToSignup?: () => void;
  onLoginSuccess?: () => void;
}

const Login: React.FC<LoginProps> = ({ onNavigateToSignup, onLoginSuccess }) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values: {
    username: string;
    password: string;
    remember: boolean;
  }) => {
    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: values.username,
          password: values.password,
          platform: 'web', 
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Login failed');
      }

      const data = await response.json();
      if (data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      }
      message.success('Logged in successfully.');
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error: any) {
      console.error('Login error', error);
      message.error(error.message || 'Unable to log in. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    console.log('Forgot password clicked');
    // Add forgot password logic here
  };

  const handleSignUp = () => {
    if (onNavigateToSignup) {
      onNavigateToSignup();
    }
  };

  return (
    <Layout
      style={{
        height: '100vh',
        width: '100%',
        background: 'linear-gradient(135deg, #4f73ff, #79acff)',
      }}
    >
      <Content
        style={{
          width: '100%',
          margin: 0,
          padding: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto', // allow scrolling inside login only
        }}
      >
        <Row
          gutter={[32, 32]}
          style={{
            maxWidth: '90vw',
            margin: '0 auto',
            background: '#79acff',
            minHeight: 600,
            borderRadius: 32,
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden',
          }}
        >
          {/* Left panel */}
          <Col
            xs={24}
            md={12}
            style={{
              background: '#4f73ff',
              color: '#fff',
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* Decorative circles */}
            <div
              style={{
                position: 'absolute',
                top: 32,
                left: 32,
                width: 71,
                height: 74,
                borderRadius: 140,
                background: '#1e1e1e',
                opacity: 0.67,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 32,
                right: 32,
                width: 71,
                height: 74,
                borderRadius: 140,
                background: '#1e1e1e',
                opacity: 0.67,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 32,
                left: 32,
                width: 71,
                height: 74,
                borderRadius: 140,
                background: '#1e1e1e',
                opacity: 0.67,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 32,
                right: 32,
                width: 71,
                height: 74,
                borderRadius: 140,
                background: '#1e1e1e',
                opacity: 0.67,
              }}
            />

            <div style={{ textAlign: 'left', marginBottom: 24 }}>
              <Title
                level={2}
                style={{
                  color: '#fff',
                  marginBottom: 12,
                  fontSize: 36,
                }}
              >
                Welcome back!
              </Title>
              <Text style={{ fontSize: 18, color: '#e0ecff' }}>
                You can sign up with your existing account
              </Text>
            </div>

            <Title
              style={{
                color: '#fff',
                fontSize: 52,
                margin: 0,
                fontFamily: 'cursive',
                letterSpacing: 1,
              }}
            >
              DormEase
            </Title>
          </Col>

          {/* Right panel */}
          <Col
            xs={24}
            md={12}
            style={{
              padding: '40px 32px',
              background: '#79acff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 450,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{ remember: false }}
                style={{ width: '100%' }}
              >
                <Form.Item
                  label="Username or Email"
                  name="username"
                  rules={[{ required: true, message: 'Please enter your username or email' }]}
                >
                  <Input placeholder="Enter your username" size="large" />
                </Form.Item>

                <Form.Item
                  label="Password"
                  name="password"
                  rules={[{ required: true, message: 'Please enter your password' }]}
                >
                  <Input.Password placeholder="Enter your password" size="large" />
                </Form.Item>

                <Form.Item
                  name="remember"
                  valuePropName="checked"
                  style={{ marginBottom: 8 }}
                >
                  <Checkbox>Remember me</Checkbox>
                </Form.Item>

                <div style={{ textAlign: 'right', marginBottom: 24 }}>
                  <Button type="link" onClick={handleForgotPassword}>
                    Forgot password?
                  </Button>
                </div>

                <Form.Item style={{ marginBottom: 24 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    style={{ borderRadius: 8, height: 56 }}
                  >
                    Login
                  </Button>
                </Form.Item>

                <div style={{ textAlign: 'center' }}>
                  <Text>Don&apos;t have an account? </Text>
                  <Button type="link" onClick={handleSignUp}>
                    Sign up
                  </Button>
                </div>
              </Form>
            </div>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default Login;