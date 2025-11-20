import mongoose from 'mongoose';

interface SlowQuery {
  command: string;
  collection: string;
  duration: number;
  timestamp: Date;
  query?: any;
  planSummary?: string;
}

interface IndexUsage {
  collection: string;
  index: string;
  accesses: number;
  since: Date;
}

interface DatabaseStats {
  collections: Array<{
    name: string;
    count: number;
    size: number;
    avgObjSize: number;
    indexes: number;
  }>;
  indexes: Array<{
    collection: string;
    name: string;
    size: number;
    usage: number;
  }>;
  slowQueries: SlowQuery[];
  connectionStats: {
    current: number;
    available: number;
    totalCreated: number;
  };
}

class DatabaseProfiler {
  private slowQueries: SlowQuery[] = [];
  private readonly maxSlowQueries = 1000;
  private profilingEnabled = false;
  
  async enableProfiling(slowMs: number = 100): Promise<void> {
    try {
      const db = mongoose.connection.db;
      
      // Set profiling level
      // Level 2: profile all operations
      // Level 1: profile only slow operations
      await db.command({
        profile: 1,
        slowms: slowMs,
        sampleRate: 1.0
      });
      
      this.profilingEnabled = true;
      console.log(`Database profiling enabled for operations slower than ${slowMs}ms`);
      
      // Start collecting profiling data
      this.startProfilingCollection();
      
    } catch (error) {
      console.error('Failed to enable database profiling:', error);
      throw error;
    }
  }
  
  async disableProfiling(): Promise<void> {
    try {
      const db = mongoose.connection.db;
      await db.command({ profile: 0 });
      this.profilingEnabled = false;
      console.log('Database profiling disabled');
    } catch (error) {
      console.error('Failed to disable database profiling:', error);
      throw error;
    }
  }
  
  private async startProfilingCollection(): Promise<void> {
    if (!this.profilingEnabled) return;
    
    try {
      const db = mongoose.connection.db;
      
      // Get profiling data every 30 seconds
      setInterval(async () => {
        try {
          const profilingData = await db.collection('system.profile')
            .find({})
            .sort({ ts: -1 })
            .limit(100)
            .toArray();
          
          profilingData.forEach((entry: any) => {
            const slowQuery: SlowQuery = {
              command: entry.command?.find ? 'find' : 
                      entry.command?.aggregate ? 'aggregate' :
                      entry.command?.update ? 'update' :
                      entry.command?.insert ? 'insert' :
                      entry.command?.delete ? 'delete' : 'unknown',
              collection: entry.ns?.split('.')[1] || 'unknown',
              duration: entry.millis || 0,
              timestamp: entry.ts || new Date(),
              query: entry.command,
              planSummary: entry.planSummary,
            };
            
            this.addSlowQuery(slowQuery);
          });
          
        } catch (error) {
          console.error('Error collecting profiling data:', error);
        }
      }, 30000);
      
    } catch (error) {
      console.error('Failed to start profiling collection:', error);
    }
  }
  
  private addSlowQuery(query: SlowQuery): void {
    this.slowQueries.push(query);
    
    // Keep only the most recent slow queries
    if (this.slowQueries.length > this.maxSlowQueries) {
      this.slowQueries = this.slowQueries.slice(-this.maxSlowQueries);
    }
  }
  
  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      const db = mongoose.connection.db;
      const admin = db.admin();
      
      // Get database stats
      const dbStats = await db.stats();
      
      // Get collection stats
      const collections = await db.listCollections().toArray();
      const collectionStats = await Promise.all(
        collections.map(async (col) => {
          try {
            const stats = await db.collection(col.name).stats();
            return {
              name: col.name,
              count: stats.count || 0,
              size: stats.size || 0,
              avgObjSize: stats.avgObjSize || 0,
              indexes: stats.nindexes || 0,
            };
          } catch (error) {
            return {
              name: col.name,
              count: 0,
              size: 0,
              avgObjSize: 0,
              indexes: 0,
            };
          }
        })
      );
      
      // Get index usage stats
      const indexStats = await this.getIndexUsageStats();
      
      // Get connection stats
      const serverStatus = await admin.serverStatus();
      const connectionStats = {
        current: serverStatus.connections?.current || 0,
        available: serverStatus.connections?.available || 0,
        totalCreated: serverStatus.connections?.totalCreated || 0,
      };
      
      return {
        collections: collectionStats,
        indexes: indexStats,
        slowQueries: this.getSlowQueries(50),
        connectionStats,
      };
      
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw error;
    }
  }
  
  private async getIndexUsageStats(): Promise<Array<{
    collection: string;
    name: string;
    size: number;
    usage: number;
  }>> {
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      const indexStats: Array<{
        collection: string;
        name: string;
        size: number;
        usage: number;
      }> = [];
      
      for (const col of collections) {
        try {
          const indexes = await db.collection(col.name).listIndexes().toArray();
          
          for (const index of indexes) {
            // Get index stats
            const stats = await db.collection(col.name).aggregate([
              { $indexStats: {} },
              { $match: { name: index.name } }
            ]).toArray();
            
            const usage = stats[0]?.accesses?.ops || 0;
            
            indexStats.push({
              collection: col.name,
              name: index.name,
              size: index.size || 0,
              usage,
            });
          }
        } catch (error) {
          // Skip collections that don't support index stats
          continue;
        }
      }
      
      return indexStats;
    } catch (error) {
      console.error('Failed to get index usage stats:', error);
      return [];
    }
  }
  
  getSlowQueries(limit: number = 100): SlowQuery[] {
    return this.slowQueries
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }
  
  async createOptimalIndexes(): Promise<void> {
    try {
      const db = mongoose.connection.db;
      
      // Common indexes for better performance
      const indexesToCreate = [
        // Patient queries
        { collection: 'patients', index: { workspaceId: 1, createdAt: -1 } },
        { collection: 'patients', index: { workspaceId: 1, 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 } },
        { collection: 'patients', index: { workspaceId: 1, isActive: 1 } },
        
        // Clinical notes queries
        { collection: 'clinicalnotes', index: { patientId: 1, createdAt: -1 } },
        { collection: 'clinicalnotes', index: { workspaceId: 1, createdAt: -1 } },
        { collection: 'clinicalnotes', index: { workspaceId: 1, type: 1 } },
        
        // Medication queries
        { collection: 'medications', index: { patientId: 1, isActive: 1 } },
        { collection: 'medications', index: { rxcui: 1 } },
        { collection: 'medications', index: { workspaceId: 1, createdAt: -1 } },
        
        // User and auth queries
        { collection: 'users', index: { email: 1 }, options: { unique: true } },
        { collection: 'users', index: { workspaceId: 1, role: 1 } },
        { collection: 'users', index: { workspaceId: 1, isActive: 1 } },
        
        // Audit log queries
        { collection: 'auditlogs', index: { workspaceId: 1, createdAt: -1 } },
        { collection: 'auditlogs', index: { userId: 1, createdAt: -1 } },
        { collection: 'auditlogs', index: { action: 1, createdAt: -1 } },
        
        // MTR queries
        { collection: 'medicationtherapyreviews', index: { patientId: 1, createdAt: -1 } },
        { collection: 'medicationtherapyreviews', index: { workspaceId: 1, status: 1 } },
        
        // Communication queries
        { collection: 'conversations', index: { workspaceId: 1, participants: 1 } },
        { collection: 'messages', index: { conversationId: 1, createdAt: -1 } },
      ];
      
      for (const { collection, index, options } of indexesToCreate) {
        try {
          await db.collection(collection).createIndex(index, options || {});
          console.log(`Created index on ${collection}:`, index);
        } catch (error) {
          // Index might already exist, continue
          console.log(`Index already exists on ${collection}:`, index);
        }
      }
      
      console.log('Optimal indexes creation completed');
      
    } catch (error) {
      console.error('Failed to create optimal indexes:', error);
      throw error;
    }
  }
  
  async analyzeSlowQueries(): Promise<Array<{
    collection: string;
    query: string;
    avgDuration: number;
    count: number;
    recommendation: string;
  }>> {
    const queryAnalysis = new Map<string, {
      durations: number[];
      count: number;
      query: any;
      collection: string;
    }>();
    
    // Group slow queries by collection and query pattern
    this.slowQueries.forEach(sq => {
      const key = `${sq.collection}:${JSON.stringify(sq.query)}`;
      
      if (!queryAnalysis.has(key)) {
        queryAnalysis.set(key, {
          durations: [],
          count: 0,
          query: sq.query,
          collection: sq.collection,
        });
      }
      
      const analysis = queryAnalysis.get(key)!;
      analysis.durations.push(sq.duration);
      analysis.count++;
    });
    
    // Generate recommendations
    const recommendations = Array.from(queryAnalysis.entries()).map(([key, analysis]) => {
      const avgDuration = analysis.durations.reduce((sum, d) => sum + d, 0) / analysis.durations.length;
      
      let recommendation = 'Consider adding appropriate indexes';
      
      if (analysis.query?.find && !analysis.query.find.$text) {
        recommendation = 'Add compound index for query fields';
      } else if (analysis.query?.aggregate) {
        recommendation = 'Optimize aggregation pipeline and add indexes for $match stages';
      } else if (avgDuration > 1000) {
        recommendation = 'Critical: Query taking over 1 second, immediate optimization needed';
      }
      
      return {
        collection: analysis.collection,
        query: JSON.stringify(analysis.query, null, 2),
        avgDuration,
        count: analysis.count,
        recommendation,
      };
    });
    
    return recommendations.sort((a, b) => b.avgDuration - a.avgDuration);
  }
  
  clearSlowQueries(): void {
    this.slowQueries = [];
  }
}

export default new DatabaseProfiler();