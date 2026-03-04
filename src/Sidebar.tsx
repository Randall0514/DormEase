import React from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  SettingOutlined,
  MessageOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

export type SectionKey = 'home' | 'settings' | 'messages' | 'profile' | 'archived';

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (value: boolean) => void;
  activeSection: SectionKey;
  onSectionChange: (section: SectionKey) => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onCollapse,
  activeSection,
  onSectionChange,
  isMobile = false,
}) => {
  // Define menu items in the visual order we want
  const menuItems = [
    { key: 'home', icon: <HomeOutlined />, label: 'Home' },
    { key: 'messages', icon: <MessageOutlined />, label: 'Messages' },
    { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  // Top: Home, Messages
  const topItems = menuItems.filter((i) => ['home', 'messages', 'profile', 'settings'].includes(i.key));

  const handleMenuClick = (key: string) => {
    onSectionChange(key as SectionKey);
    if (isMobile) {
      onCollapse(true);
    }
  };

  const menuContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
      <div>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: collapsed ? 18 : 20,
            letterSpacing: 0.5,
          }}
        >
          {collapsed ? 'DE' : 'DormEase'}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeSection]}
          onClick={({ key }) => handleMenuClick(String(key))}
          style={{ background: 'transparent', border: 'none' }}
          items={topItems}
        />
      </div>

      <div style={{ padding: '12px 0' }}>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeSection]}
          onClick={({ key }) => handleMenuClick(String(key))}
          style={{ background: 'transparent', border: 'none' }}
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: 220,
          transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.25s ease',
          background: 'linear-gradient(180deg, #4f73ff 0%, #79acff 100%)',
          zIndex: 1000,
          boxShadow: !collapsed ? '0 6px 24px rgba(0,0,0,0.25)' : undefined,
          overflowY: 'auto',
        }}
      >
        {menuContent}
      </div>
    );
  }

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="md"
      collapsedWidth={0}
      width={220}
      style={{
        background: 'linear-gradient(180deg, #4f73ff 0%, #79acff 100%)',
        position: 'relative',
      }}
    >
      {menuContent}
    </Sider>
  );
};

export default Sidebar;

