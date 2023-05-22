import axios from 'axios';
import { readFileSync, existsSync } from "fs";
import { createObjectCsvWriter } from 'csv-writer';
import BaseImporter from './baseImporter.js';
import dotenv from 'dotenv';
const { youTube: importConfig } = JSON.parse(readFileSync('./config.json'));
const { period, publishedAfter, publishedBefore} = importConfig;

dotenv.config();

const { YOUTUBE_API_KEY } = process.env;

export default class Youtube extends BaseImporter {
  accounts = [];

  constructor() {
    super();
  }

  async getAccounts () {
    const query = "SELECT ac.* FROM test_task_data.accounts ac INNER JOIN test_task_data.sources sc ON ac._source_id = sc._id WHERE ac._platform = 'YouTube'";
    this.accounts = await super.getData(query);
  }

  async findAndUpdateInfo() {
    for (const account of this.accounts) {
      const [channelInfo, videosInfo] = await Promise.allSettled([
        this.getInfoByChannelId(account.id),
        this.getVideosByChanelId(account.id),
      ]);
      
      if (channelInfo.status === 'rejected') {
        console.error("Can't get channelInfo: ", channelInfo.reason);
      }
  
      if (videosInfo.status === 'rejected') {
        console.error("Can't get videosInfo: ", videosInfo.reason);
      }
  
      await this.updateInfo({channelInfo: channelInfo.value, videosInfo: videosInfo.value})
    }
  }

  async getInfoByChannelId(channelId) {
    try {
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`;
      const response = await axios.get(channelUrl);
      const data = response.data;
      if (!data.pageInfo.totalResults) {
        console.log(`Channel with id: "${channelId}" is not found`);
        return null;
      }
      const channel = data.items[0];
      const { title, description, publishedAt, defaultLanguage } = channel.snippet;
      const subscriberCount = channel.statistics.subscriberCount;
      
      return {id: channelId, title, description, publishedAt, defaultLanguage, subscriberCount};
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('An error occurred while request dta from API:');
        console.error(error.response.data);
        console.error(error.response.status);
        console.error(error.response.headers);
      } else {
        console.error('An error occurred while receiving data:', error.message);
      }
    }
  }

  async getVideosByChanelId(channelId) {
    const result = [];
    let periodString = '';
    if (period) {
      periodString = `&publishedAfter=${publishedAfter}&publishedBefore=${publishedBefore}`;
    }
    const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}${periodString}&key=${YOUTUBE_API_KEY}`;
    const response = await axios.get(videosUrl);
    const data = response.data;
    if (!data.pageInfo.totalResults) {
      console.log(`There is no videos on channel: "${channelId}" ${ period ? `for period: ${publishedAfter} - ${publishedBefore}` : ''}`);
      return null;
    }
    const videos = data.items;
    for (const video of videos) {
      const videoId = video.id.videoId;
      const statistic = await this.getVideoStatistic(videoId);
      result.push({id: videoId, ...video.snippet, statistic})
      break;
    }
    return result;
  }

  async getVideoStatistic(videoId) {
    try {
      const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  
      const response = await axios.get(statsUrl);
      const data = response.data;
      if (!data.pageInfo.totalResults) {
        console.log(`Video with id: "${videoId}" is not found`);
        return null;
      }

      const videoStats = data.items[0].statistics;
      
      return videoStats;
    } catch (error) {
      console.error('Сталася помилка при отриманні статистики відео:', error.message);
    }
  }

  // For test perspective all data added as csv files
  // Files will be created only for defined fields for update
  async updateInfo(data) {
    const { channelInfo, videosInfo } = data;
    await this.updateChannelData(channelInfo);
    await this.updatePostsData(videosInfo);
  }

  async updateChannelData(channelInfo) {
    try {
      if (channelInfo) {
        // TODO create DTO
        const chanelData = [{
          id: channelInfo.id,
          fullName: channelInfo.title,
          description: channelInfo.description,
          createdTime: channelInfo.publishedAt,
          subscriberCount: channelInfo.subscriberCount
        }];
        await this.writeToFile({header: this.channelHeaders, path: './channel.csv', data: chanelData});
      }
    } catch (error) {
      console.error("Can't add channel data:", error);
    }  
  }

  async updatePostsData(postInfo) {
    try {
      const postsData = [];
      if (postInfo && postInfo.length) {
        postInfo.forEach(post => {
          // TODO create DTO
          const data = {
            id: post.id,
            title: post.title,
            description: post.description,
            createdTime: post.publishedAt,
            viewCount: post.statistic.viewCount,
            likeCount: post.statistic.likeCount,
            commentCount: post.statistic.commentCount
          };
          postsData.push(data);
        });
        await this.writeToFile({header: this.postHeaders, path: './posts.csv', data: postsData});
      }
    } catch (error) {
      console.error("Can't add data:", error);
    }   
  }

  async writeToFile(params) {
    const {header, path, data} = params;
    try {
      const fileExists = existsSync(path);
      const csvWriter = createObjectCsvWriter({
        path,
        header,
        append: fileExists
      });

      await csvWriter.writeRecords(data);
      console.log('The data has been successfully written to a CSV file');
    } catch (error) {
      console.error('An error occurred while writing to the CSV file:', error);
    }
  }

  get postHeaders() {
    return [
      { id: 'id', title: 'Id' },
      { id: 'description', title: 'description' },
      { id: 'title', title: 'title' },
      { id: 'createdTime', title: 'created_time' },
      { id: 'viewCount', title: 'view_count' },
      { id: 'likeCount', title: 'like_count' },
      { id: 'commentCount', title: 'comment_count' }
    ];
  }

  get channelHeaders() {
    return [
      { id: 'id', title: 'Id' },
      { id: 'fullName', title: 'full_name' },
      { id: 'description', title: 'description' },
      { id: 'createdTime', title: 'created_time' },
      { id: 'subscriberCount', title: 'subscriber_count' }
    ];
  }
  

  async main() {
    await this.getAccounts();
    await this.findAndUpdateInfo();
  }
}