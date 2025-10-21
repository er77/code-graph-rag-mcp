/**
 * Knowledge Sharing Bus for inter-agent communication
 * Implements pub/sub pattern with topic-based routing
 */

import { EventEmitter } from "node:events";
import type { AgentMessage } from "../types/agent.js";

export interface KnowledgeEntry {
  id: string;
  topic: string;
  data: unknown;
  source: string;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

export interface Subscription {
  id: string;
  agentId: string;
  topic: string | RegExp;
  handler: (entry: KnowledgeEntry) => void | Promise<void>;
}

export class KnowledgeBus extends EventEmitter {
  private knowledge: Map<string, KnowledgeEntry[]> = new Map();
  private subscriptions: Map<string, Subscription[]> = new Map();
  private messageQueue: AgentMessage[] = [];
  private maxQueueSize = 1000;
  private maxKnowledgePerTopic = 100;

  constructor() {
    super();
    this.startCleanupInterval();
  }

  /**
   * Publish knowledge to a topic
   */
  publish(topic: string, data: unknown, source: string, ttl?: number): void {
    const entry: KnowledgeEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      topic,
      data,
      source,
      timestamp: Date.now(),
      ttl,
    };

    // Store knowledge
    if (!this.knowledge.has(topic)) {
      this.knowledge.set(topic, []);
    }

    const entries = this.knowledge.get(topic)!;
    entries.push(entry);

    // Limit entries per topic
    if (entries.length > this.maxKnowledgePerTopic) {
      entries.shift(); // Remove oldest
    }

    // Notify subscribers
    this.notifySubscribers(entry);

    this.emit("knowledge:published", entry);
  }

  /**
   * Subscribe to knowledge updates
   */
  subscribe(agentId: string, topic: string | RegExp, handler: (entry: KnowledgeEntry) => void | Promise<void>): string {
    const subscription: Subscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      topic,
      handler,
    };

    const topicKey = topic instanceof RegExp ? "*" : topic;

    if (!this.subscriptions.has(topicKey)) {
      this.subscriptions.set(topicKey, []);
    }

    this.subscriptions.get(topicKey)?.push(subscription);

    this.emit("subscription:created", subscription);

    return subscription.id;
  }

  /**
   * Unsubscribe from knowledge updates
   */
  unsubscribe(subscriptionId: string): void {
    for (const [, subs] of this.subscriptions) {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        this.emit("subscription:removed", subscriptionId);
        break;
      }
    }
  }

  /**
   * Query existing knowledge
   */
  query(topic: string | RegExp, limit = 10): KnowledgeEntry[] {
    const results: KnowledgeEntry[] = [];

    for (const [storedTopic, entries] of this.knowledge) {
      if (this.matchesTopic(storedTopic, topic)) {
        results.push(...entries);
      }
    }

    // Sort by timestamp descending and limit
    return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * Send a direct message between agents
   */
  async sendMessage(message: AgentMessage): Promise<void> {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift(); // Remove oldest message
    }

    this.messageQueue.push(message);
    this.emit("message:sent", message);

    // If it's a broadcast, publish to knowledge bus
    if (message.to === "*") {
      this.publish(`message:${message.type}`, message.payload, message.from);
    }
  }

  /**
   * Get recent messages
   */
  getRecentMessages(limit = 10): AgentMessage[] {
    return this.messageQueue.slice(-limit);
  }

  /**
   * Clear knowledge for a specific topic
   */
  clearTopic(topic: string): void {
    this.knowledge.delete(topic);
    this.emit("topic:cleared", topic);
  }

  /**
   * Get statistics about the knowledge bus
   */
  getStats(): {
    topicCount: number;
    entryCount: number;
    subscriptionCount: number;
    messageQueueSize: number;
  } {
    let entryCount = 0;
    let subscriptionCount = 0;

    for (const entries of this.knowledge.values()) {
      entryCount += entries.length;
    }

    for (const subs of this.subscriptions.values()) {
      subscriptionCount += subs.length;
    }

    return {
      topicCount: this.knowledge.size,
      entryCount,
      subscriptionCount,
      messageQueueSize: this.messageQueue.length,
    };
  }

  // Private methods

  private matchesTopic(storedTopic: string, pattern: string | RegExp): boolean {
    if (typeof pattern === "string") {
      // Support wildcards in string patterns
      if (pattern.includes("*")) {
        const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
        return regex.test(storedTopic);
      }
      return storedTopic === pattern;
    }
    return pattern.test(storedTopic);
  }

  private notifySubscribers(entry: KnowledgeEntry): void {
    // Notify exact topic subscribers
    const exactSubs = this.subscriptions.get(entry.topic) || [];
    for (const sub of exactSubs) {
      this.callHandler(sub, entry);
    }

    // Notify wildcard/regex subscribers
    const wildcardSubs = this.subscriptions.get("*") || [];
    for (const sub of wildcardSubs) {
      if (this.matchesTopic(entry.topic, sub.topic)) {
        this.callHandler(sub, entry);
      }
    }
  }

  private async callHandler(subscription: Subscription, entry: KnowledgeEntry): Promise<void> {
    try {
      await subscription.handler(entry);
    } catch (error) {
      console.error(`Error in subscription handler for agent ${subscription.agentId}:`, error);
      this.emit("subscription:error", { subscription, error });
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredKnowledge();
    }, 60000); // Run every minute
  }

  private cleanupExpiredKnowledge(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [topic, entries] of this.knowledge) {
      const validEntries = entries.filter((entry) => {
        if (entry.ttl && now - entry.timestamp > entry.ttl) {
          cleanedCount++;
          return false;
        }
        return true;
      });

      if (validEntries.length === 0) {
        this.knowledge.delete(topic);
      } else {
        this.knowledge.set(topic, validEntries);
      }
    }

    if (cleanedCount > 0) {
      this.emit("cleanup:completed", { entriesRemoved: cleanedCount });
    }
  }
}

// Singleton instance
export const knowledgeBus = new KnowledgeBus();
