import React from 'react';
import { Layout, Typography, Form, Input, Checkbox, Button, message } from 'antd';

const { Content } = Layout;
const { Title, Text } = Typography;

interface SignupProps {
  onNavigateToLogin?: () => void;
  onSignupSuccess?: () => void;
}

const Signup: React.FC<SignupProps> = ({ onNavigateToLogin, onSignupSuccess }) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    agree: boolean;
  }) => {
    try {
      const response = await fetch('http://localhost:3000/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: values.fullName,
          username: values.username,
          email: values.email,
          password: values.password,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Signup failed');
      }

      await response.json();
      message.success('Account created successfully.');
      if (onSignupSuccess) {
        onSignupSuccess();
      }
    } catch (error: any) {
      console.error('Signup error', error);
      message.error(error.message || 'Unable to create account. Please try again.');
    }
  };

  const handleBackToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
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
        }}
      >
        <div
          style={{
            width: '70vw',
            maxWidth: 900,
            minHeight: 420,
            background: '#79acff',
            borderRadius: 32,
            padding: '24px 32px 28px',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={2} style={{ margin: 0, color: '#111827', letterSpacing: 0.3 }}>
              Create account
            </Title>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ agree: false }}
          >
            <Form.Item
              label="Full Name"
              name="fullName"
              rules={[{ required: true, message: 'Please enter your full name' }]}
            >
              <Input placeholder="Enter your full name" size="large" />
            </Form.Item>

            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: 'Please choose a username' }]}
            >
              <Input placeholder="Choose a username" size="large" />
            </Form.Item>

            <Form.Item
              label="Email Address"
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email address' },
              ]}
            >
              <Input placeholder="Enter your email" size="large" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Please create a password' }]}
            >
              <Input.Password placeholder="Create a password" size="large" />
            </Form.Item>

            <Form.Item
              label="Confirm Password"
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('The two passwords do not match')
                    );
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Confirm your password" size="large" />
            </Form.Item>

            <Form.Item
              name="agree"
              valuePropName="checked"
              style={{ marginBottom: 24 }}
              rules={[
                {
                  validator: (_, value) =>
                    value
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error('You must agree to the terms to continue')
                        ),
                },
              ]}
            >
              <Checkbox>
                I agree to the{' '}
                <Text underline style={{ color: '#1f3fd1' }}>
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text underline style={{ color: '#1f3fd1' }}>
                  Privacy Policy
                </Text>
              </Checkbox>
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                style={{
                  borderRadius: 8,
                  height: 52,
                  background: '#4f73ff',
                }}
              >
                Create Account
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Text>Already have an account? </Text>
              <Button type="link" onClick={handleBackToLogin}>
                Log in
              </Button>
            </div>
          </Form>
        </div>
      </Content>
    </Layout>
  );
};

export default Signup;

