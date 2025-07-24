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

// Basic Examples
export const Default: Story<ChatWidgetProps> = ({ ...args }) => (
  <div style={{ height: '600px', width: '100%' }}>
    <ChatWidget {...args} />
  </div>
);
Default.storyName = 'Default';

export const MinimalSetup: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <h3>Minimal Setup Example</h3>
    <p>This shows the ChatWidget with only the required baseURL prop:</p>
    <ChatWidget baseURL="http://localhost:3000" />
  </div>
);
MinimalSetup.storyName = 'Minimal Setup';

// Theme Variations
export const ThemeLight: Story<ChatWidgetProps> = () => (
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
ThemeLight.storyName = 'Theme/Light';

export const ThemeDark: Story<ChatWidgetProps> = () => (
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
ThemeDark.storyName = 'Theme/Dark';

export const ThemeCustom: Story<ChatWidgetProps> = () => (
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
ThemeCustom.storyName = 'Theme/Custom';

// Provider Configurations
export const ProviderOpenAI: Story<ChatWidgetProps> = () => (
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
ProviderOpenAI.storyName = 'Provider/OpenAI';

export const ProviderAnthropic: Story<ChatWidgetProps> = () => (
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
ProviderAnthropic.storyName = 'Provider/Anthropic';

// Position Variations
export const PositionInline: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <ChatWidget
      baseURL="http://localhost:3000"
      position="inline"
      title="Inline Chat"
    />
  </div>
);
PositionInline.storyName = 'Position/Inline';

export const PositionFixed: Story<ChatWidgetProps> = () => (
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
PositionFixed.storyName = 'Position/Fixed Bottom Right';

// Streaming Examples
export const StreamingDefault: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <h3>Streaming Responses (Default)</h3>
    <p>
      Watch as AI responses stream in word-by-word for a more interactive
      experience:
    </p>
    <ChatWidget
      baseURL="http://localhost:3000"
      title="Streaming Chat (Default)"
      placeholder="Ask me to tell a story..."
      system="You are a helpful assistant. When asked for stories or explanations, provide detailed responses to showcase streaming."
    />
  </div>
);
StreamingDefault.storyName = 'Streaming/Default Behavior';

export const StreamingDisabled: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <h3>Non-Streaming Responses</h3>
    <p>Responses appear all at once when streaming is disabled:</p>
    <ChatWidget
      baseURL="http://localhost:3000"
      title="Non-Streaming Chat"
      placeholder="Ask me anything..."
      streaming={false}
      system="You are a helpful assistant. Keep responses concise for non-streaming mode."
    />
  </div>
);
StreamingDisabled.storyName = 'Streaming/Disabled';

export const StreamingComparison: Story<ChatWidgetProps> = () => (
  <div style={{ display: 'flex', gap: '20px', height: '600px' }}>
    <div style={{ flex: 1 }}>
      <h3>Streaming (Default)</h3>
      <ChatWidget
        baseURL="http://localhost:3000"
        title="Streaming Mode"
        placeholder="Ask for a story..."
        theme="light"
      />
    </div>
    <div style={{ flex: 1 }}>
      <h3>Non-Streaming</h3>
      <ChatWidget
        baseURL="http://localhost:3000"
        title="Non-Streaming Mode"
        placeholder="Ask for a story..."
        theme="dark"
        streaming={false}
      />
    </div>
  </div>
);
StreamingComparison.storyName = 'Streaming/Side-by-Side Comparison';

// Use Case Examples
export const UseCaseCustomerSupport: Story<ChatWidgetProps> = () => (
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
UseCaseCustomerSupport.storyName = 'Use Cases/Customer Support';

export const UseCaseTechnicalAssistant: Story<ChatWidgetProps> = () => (
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
UseCaseTechnicalAssistant.storyName = 'Use Cases/Technical Assistant';

export const UseCaseWithCodeExample: Story<ChatWidgetProps> = () => (
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
      // streaming={true} is the default
    />
  );

  // To disable streaming:
  // <ChatWidget 
  //   baseURL="http://localhost:3000"
  //   streaming={false}
  // />
}`}</code>
      </pre>
    </div>
  </div>
);
UseCaseWithCodeExample.storyName = 'Use Cases/With Code Example';

export const StreamingWithError: Story<ChatWidgetProps> = () => (
  <div style={{ height: '600px', width: '100%' }}>
    <h3>Streaming Error Handling</h3>
    <p>Test error handling during streaming by using an invalid URL:</p>
    <ChatWidget
      baseURL="http://invalid-url:9999"
      title="Error Handling Demo"
      placeholder="Try sending a message..."
    />
    <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
      Note: This intentionally uses an invalid URL to demonstrate error
      handling.
    </p>
  </div>
);
StreamingWithError.storyName = 'Streaming/Error Handling';
