import type { Story, StoryDefault } from '@ladle/react';
import { ChatWidget } from './ChatWidget.js';
import type { ChatWidgetProps } from './ChatWidget.js';

export default {
  title: 'Components/ChatWidget',
  args: {
    baseURL: 'http://localhost:3000',
    theme: 'auto',
    position: 'inline',
    placeholder: 'Type a message...',
    title: 'AI Assistant',
  },
  argTypes: {
    baseURL: {
      control: { type: 'text' },
      description: 'Base URL for the Airbolt API',
    },
    theme: {
      control: { type: 'select' },
      options: ['light', 'dark', 'auto'],
      description: 'Theme mode',
    },
    position: {
      control: { type: 'select' },
      options: ['inline', 'fixed-bottom-right'],
      description: 'Widget positioning mode',
    },
    provider: {
      control: { type: 'select' },
      options: ['openai', 'anthropic'],
      description: 'AI provider to use',
    },
    model: {
      control: { type: 'text' },
      description:
        'Specific model to use (e.g., gpt-4, claude-3-5-sonnet-20241022)',
    },
    system: {
      control: { type: 'text' },
      description: "System prompt to guide the AI's behavior",
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text for the input field',
    },
    title: {
      control: { type: 'text' },
      description: 'Title displayed in the widget header',
    },
  },
} satisfies StoryDefault<ChatWidgetProps>;

export const Default: Story<ChatWidgetProps> = ({ ...args }) => (
  <div style={{ height: '600px', width: '100%' }}>
    <ChatWidget {...args} />
  </div>
);

export const DarkTheme: Story<ChatWidgetProps> = () => (
  <div
    style={{
      height: '600px',
      width: '100%',
      backgroundColor: '#1a1a1a',
      padding: '20px',
    }}
  >
    <ChatWidget
      baseURL="http://localhost:3000"
      theme="dark"
      title="Dark Mode Chat"
    />
  </div>
);

export const LightTheme: Story<ChatWidgetProps> = () => (
  <div
    style={{
      height: '600px',
      width: '100%',
      backgroundColor: '#f5f5f5',
      padding: '20px',
    }}
  >
    <ChatWidget
      baseURL="http://localhost:3000"
      theme="light"
      title="Light Mode Chat"
    />
  </div>
);

export const FixedPosition: Story<ChatWidgetProps> = () => (
  <div style={{ height: '100vh', position: 'relative' }}>
    <div style={{ padding: '20px' }}>
      <h2>Page Content</h2>
      <p>This demonstrates the fixed-bottom-right positioning mode.</p>
      <p>The chat widget appears in the bottom right corner.</p>
    </div>
    <ChatWidget
      baseURL="http://localhost:3000"
      position="fixed-bottom-right"
      title="Support Chat"
    />
  </div>
);

export const OpenAIProvider: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <ChatWidget
      baseURL="http://localhost:3000"
      provider="openai"
      model="gpt-4o-mini"
      system="You are a helpful assistant powered by OpenAI. Keep responses concise."
      title="OpenAI Assistant"
    />
  </div>
);

export const AnthropicProvider: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <ChatWidget
      baseURL="http://localhost:3000"
      provider="anthropic"
      model="claude-3-5-sonnet-20241022"
      system="You are Claude, an AI assistant created by Anthropic. Be helpful and concise."
      title="Claude Assistant"
    />
  </div>
);

export const CustomTheme: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <ChatWidget
      baseURL="http://localhost:3000"
      minimalTheme={{
        primary: '#ff6b6b',
        surface: '#ffe0e0',
        border: '#ff9999',
        text: '#333333',
      }}
      title="Custom Themed Chat"
    />
  </div>
);

export const CustomerSupport: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <ChatWidget
      baseURL="http://localhost:3000"
      system="You are a customer support agent. Be helpful, professional, and empathetic. Always try to resolve customer issues efficiently."
      placeholder="How can we help you today?"
      title="Customer Support"
      minimalTheme={{
        primary: '#059669',
        surface: '#d1fae5',
        border: '#34d399',
        text: '#064e3b',
      }}
    />
  </div>
);

export const TechnicalAssistant: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <ChatWidget
      baseURL="http://localhost:3000"
      system="You are a technical assistant specializing in software development. Provide code examples when relevant and explain technical concepts clearly."
      placeholder="Ask me about coding..."
      title="Tech Assistant"
      provider="anthropic"
      model="claude-3-5-sonnet-20241022"
    />
  </div>
);

export const MinimalSetup: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <h3>Minimal Setup Example</h3>
    <p>This shows the ChatWidget with only the required baseURL prop:</p>
    <ChatWidget baseURL="http://localhost:3000" />
  </div>
);

export const WithCodeExample: Story<ChatWidgetProps> = () => (
  <div style={{ display: 'flex', gap: '20px', height: '600px' }}>
    <div style={{ flex: 1 }}>
      <h3>Live Demo</h3>
      <ChatWidget baseURL="http://localhost:3000" />
    </div>
    <div
      style={{
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
      }}
    >
      <h3>Code</h3>
      <pre
        style={{
          backgroundColor: '#282c34',
          color: '#abb2bf',
          padding: '16px',
          borderRadius: '4px',
          overflow: 'auto',
        }}
      >
        <code>{`import { ChatWidget } from '@airbolt/react-sdk';

function App() {
  return (
    <ChatWidget 
      baseURL="http://localhost:3000"
    />
  );
}`}</code>
      </pre>
    </div>
  </div>
);
